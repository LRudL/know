from datetime import datetime
import traceback
from fastapi import APIRouter, Depends, HTTPException
from src.api.graph import get_graph_learning_state
from src.services import get_supabase_client
from src.services.security import get_user_id_from_token, security
from src.api.models import (
    LearningProgressUpdateRequest,
)
from src.api.learning_progress import (
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
        print("Full error traceback:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={
                "message": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc(),
            },
        )


@router.post("/learning_update")
async def learning_update_route(
    update: LearningProgressUpdateRequest, token: str = Depends(security)
):
    print(f"Received learning update: {update}")
    try:
        client = get_supabase_client(token)
        user_id = get_user_id_from_token(token)
        update.user_id = user_id  # get this from authentication, since we need it to build the LearningProgress later on
        return await update_learning_progress(update, client)
    except Exception as e:
        print("Full error traceback:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={
                "message": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc(),
            },
        )


@router.delete("/learning_delete/{learning_node_id}")
async def learning_delete_route(learning_node_id: str, token: str = Depends(security)):
    try:
        client = get_supabase_client(token)
        return await delete_learning_progress(learning_node_id, client)
    except Exception as e:
        print("Full error traceback:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={
                "message": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc(),
            },
        )
