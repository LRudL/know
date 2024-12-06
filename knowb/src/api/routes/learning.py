from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from src.services import get_supabase_client
from src.services.security import security
from src.api.models import (
    LearningProgressUpdateRequest,
)
from src.api.learning_progress import (
    get_graph_learning_state,
    update_learning_progress,
    delete_learning_progress,
)

router = APIRouter()


@router.get("/get_graph_learning_state/{graph_id}")
async def get_graph_learning_state_route(
    graph_id: str, date: datetime, token: str = Depends(security)
):
    try:
        client = get_supabase_client(token)
        return await get_graph_learning_state(graph_id, date, client)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )


@router.post("/learning_update")
async def learning_update_route(
    update: LearningProgressUpdateRequest, token: str = Depends(security)
):
    try:
        client = get_supabase_client(token)
        return await update_learning_progress(update, client)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )


@router.delete("/learning_delete/{learning_node_id}")
async def learning_delete_route(learning_node_id: str, token: str = Depends(security)):
    try:
        client = get_supabase_client(token)
        return await delete_learning_progress(learning_node_id, client)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )
