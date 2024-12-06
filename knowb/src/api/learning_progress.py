from datetime import datetime
from typing import Optional
from supabase import Client
from fastapi import HTTPException
from pydantic import BaseModel
from src.api.models import (
    LearningProgress,
    LearningProgressUpdate,
    LearningProgressUpdateRequest,
    SpacedRepState,
    ContentMapNode,
)


async def get_current_spaced_rep_state(
    learning_progress_id: str, client: Client
) -> SpacedRepState:
    """Get the current spaced repetition state for a learning node"""
    result = (
        client.from_("learning_progress")
        .select("spaced_rep_state")
        .eq("id", learning_progress_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Learning node not found")

    return result.data[0]["spaced_rep_state"]


async def create_learning_progress_update_from_request(
    request: LearningProgressUpdateRequest, client: Client
) -> LearningProgressUpdate:
    """Create a LearningProgressUpdate from a LearningProgressUpdateRequest (i.e. lookup the SpacedRepState)"""
    current_state = await get_current_spaced_rep_state(
        request.learning_progress_id, client
    )
    return LearningProgressUpdate(
        learning_progress_id=request.learning_progress_id,
        message_id=request.message_id,
        created_at=request.created_at,
        spaced_rep_state=current_state,
        update_data=request.update_data,
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

    return GraphLearningState(
        past=past, to_review=to_review, not_yet_learned=not_yet_learned
    )


async def update_learning_progress(
    update: LearningProgressUpdate, client: Client
) -> dict:
    """Update learning progress for a node"""
    result = (
        client.from_("learning_progress")
        .update(
            {
                "spaced_rep_state": update.spaced_rep_state,
                "version": update.spaced_rep_state.version + 1,
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


async def update_learning_progress_from_request(
    request: LearningProgressUpdateRequest, client: Client
) -> dict:
    """Update learning progress for a node from a LearningProgressUpdateRequest"""
    update = await create_learning_progress_update_from_request(request, client)
    return await update_learning_progress(update, client)


async def delete_learning_progress(learning_node_id: str, client: Client) -> dict:
    """Delete learning progress for a node"""
    result = (
        client.from_("learning_progress").delete().eq("id", learning_node_id).execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Learning node not found")

    return {"status": "deleted"}
