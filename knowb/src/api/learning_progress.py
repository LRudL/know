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
        print(f"Creating new LearningProgress entry for node {request.node_id}")
        # 1.1 Create new LearningProgress entry with default SpacedRepState
        new_progress = {
            "node_id": request.node_id,
            "graph_id": request.graph_id,  # You'll need to pass this as a parameter
            "user_id": request.user_id,  # You'll need to pass this as a parameter
            "version": 1,
            "spaced_rep_state": SpacedRepState().model_dump(mode="json"),
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

    update = LearningProgressUpdate(
        learning_progress_id=progress_id,
        message_id=request.message_id,
        created_at=request.created_at,
        update_data=request.update_data,
    )

    # 3. Log LearningProgressUpdate to database
    update_result = (
        client.from_("learning_progress_updates")
        .insert(update.model_dump(mode="json"))
        .execute()
    )
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
    print(
        f"Updating learning progress in update_learning_progress for node {request.node_id}"
    )
    # Get the LearningProgressUpdate and LearningProgress
    update, current_progress = await learning_progress_update_from_request(
        request, client
    )

    # Apply spaced repetition update
    new_spaced_rep_state = apply_learning_update(
        current_progress.spaced_rep_state, update, update.created_at
    )

    # Update the learning progress entry
    result = (
        client.from_("learning_progress")
        .update(
            {
                "spaced_rep_state": new_spaced_rep_state.model_dump(mode="json"),
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
    # First, get the learning progress ID
    learning_progress = (
        client.table("learning_progress")
        .select("id")
        .eq("node_id", learning_node_id)
        .single()
        .execute()
    ).data

    if learning_progress:
        # Delete related learning progress updates first
        (
            client.table("learning_progress_updates")
            .delete()
            .eq("learning_progress_id", learning_progress["id"])
            .execute()
        )

        # Then delete the learning progress itself
        return (
            client.table("learning_progress")
            .delete()
            .eq("node_id", learning_node_id)
            .execute()
        )

    return None
