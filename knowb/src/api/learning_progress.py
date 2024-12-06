from datetime import datetime
from typing import Optional
from supabase import Client
from fastapi import HTTPException
from pydantic import BaseModel
from src.api.spaced_repetition import apply_learning_update
from src.api.models import (
    LearningProgress,
    LearningProgressUpdate,
    LearningProgressUpdateRequest,
    SpacedRepState,
    ContentMapNode,
)


class NodeState(BaseModel):
    node: ContentMapNode
    spaced_rep_state: Optional[SpacedRepState]


class GraphLearningState(BaseModel):
    past: list[NodeState]
    to_review: list[NodeState]
    not_yet_learned: list[NodeState]


async def get_graph_learning_state(
    graph_id: str, date: datetime, client: Client
) -> GraphLearningState:
    """Get learning state for all nodes in a graph"""
    learning_progress_result = (
        client.from_("learning_progress").select("*").eq("graph_id", graph_id).execute()
    )
    # Use model_validate instead of manual conversion for converting SQL rows to LearningProgress
    learning_progresses = [
        LearningProgress.model_validate(item) for item in learning_progress_result.data
    ]

    # get the nodes
    nodes_result = (
        client.from_("graph_nodes").select("*").eq("graph_id", graph_id).execute()
    )
    # Use model_validate for nodes too
    nodes = [ContentMapNode.model_validate(node) for node in nodes_result.data]

    # Create lookup dict for learning progress by node_id
    progress_by_node = {lp.node_id: lp for lp in learning_progresses}

    past = []
    to_review = []
    not_yet_learned = []

    # Categorize each node
    for node in nodes:
        progress = progress_by_node.get(node.id)

        if not progress:
            # No learning progress exists
            not_yet_learned.append(NodeState(node=node, spaced_rep_state=None))
            continue

        state = progress.spaced_rep_state
        if not state.next_review:
            # No next review scheduled yet
            not_yet_learned.append(NodeState(node=node, spaced_rep_state=state))
        elif state.next_review > date:
            # Next review is in the future
            past.append(NodeState(node=node, spaced_rep_state=state))
        else:
            # Next review is due (in the past or present)
            to_review.append(NodeState(node=node, spaced_rep_state=state))

    # sort by node.order_index in each list
    past.sort(key=lambda x: x.node.order_index)
    to_review.sort(key=lambda x: x.node.order_index)
    not_yet_learned.sort(key=lambda x: x.node.order_index)

    return GraphLearningState(
        past=past, to_review=to_review, not_yet_learned=not_yet_learned
    )


async def learning_progress_update_from_request(
    request: LearningProgressUpdateRequest, client: Client
) -> LearningProgressUpdate:
    # 1. Check if there exists a LearningProgress with that node_id
    progress_result = (
        client.from_("learning_progress")
        .select("*")
        .eq("node_id", request.node_id)
        .execute()
    )

    if not progress_result.data:
        # 1.1 Create new LearningProgress entry with default SpacedRepState
        new_progress = {
            "node_id": request.node_id,
            "graph_id": request.graph_id,  # You'll need to pass this as a parameter
            "user_id": request.user_id,  # You'll need to pass this as a parameter
            "version": 1,
            "spaced_rep_state": SpacedRepState().model_dump(),
        }
        progress_result = (
            client.from_("learning_progress").insert(new_progress).execute()
        )
        if not progress_result.data:
            raise HTTPException(
                status_code=500, detail="Failed to create learning progress"
            )
        progress_id = progress_result.data[0]["id"]
    else:
        progress_id = progress_result.data[0]["id"]

    # 2. Create LearningProgressUpdate
    update = {
        "learning_progress_id": progress_id,
        "message_id": request.message_id,
        "created_at": request.created_at,
        "update_data": request.update_data.model_dump(),
    }

    # 3. Log LearningProgressUpdate to database
    update_result = client.from_("learning_progress_updates").insert(update).execute()
    if not update_result.data:
        raise HTTPException(
            status_code=500, detail="Failed to log learning progress update"
        )

    # 4. Return the update and the learning_progress
    return LearningProgressUpdate.model_validate(
        update_result.data[0]
    ), LearningProgress.model_validate(progress_result.data[0])


async def update_learning_progress(
    request: LearningProgressUpdateRequest, client: Client
) -> dict:
    """Update learning progress for a node from a LearningProgressUpdate"""
    # Get the LearningProgressUpdate and LearningProgress
    update, current_progress = await learning_progress_update_from_request(
        request, client
    )

    # Apply spaced repetition update
    new_spaced_rep_state = apply_learning_update(
        current_progress.spaced_rep_state, update.update_data, update.created_at
    )

    # Update the learning progress entry
    result = (
        client.from_("learning_progress")
        .update(
            {
                "spaced_rep_state": new_spaced_rep_state.model_dump(),
                "version": current_progress.version + 1,
            }
        )
        .eq("id", update.learning_progress_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=500, detail="Failed to update learning progress"
        )

    return {"status": "success"}


async def delete_learning_progress(learning_node_id: str, client: Client) -> dict:
    """Delete learning progress for a node"""
    result = (
        client.from_("learning_progress").delete().eq("id", learning_node_id).execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Learning node not found")

    return {"status": "deleted"}
