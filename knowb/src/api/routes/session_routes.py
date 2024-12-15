from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.api.ai.session import handle_chat_stream
from src.services.security import security

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    session_id: str


@router.get("/stream")
async def stream_chat(message: str, session_id: str, token: str = Depends(security)):
    return StreamingResponse(
        handle_chat_stream(message, session_id, token),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
