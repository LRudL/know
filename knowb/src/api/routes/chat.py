from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import anthropic
import os
from pydantic import BaseModel
from src.services.security import security
from src.services import get_supabase_client
import asyncio

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    session_id: str


@router.get("/stream")
async def stream_chat(message: str, session_id: str, token: str = Depends(security)):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    supabase = get_supabase_client()

    # Get chat history
    history_response = (
        supabase.table("chat_messages")
        .select("content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    if hasattr(history_response, "error") and history_response.error:
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")

    messages = [msg["content"] for msg in history_response.data]

    # Store user message
    user_message = {
        "session_id": session_id,
        "content": {"role": "user", "content": message},
    }
    user_msg_response = supabase.table("chat_messages").insert(user_message).execute()
    if hasattr(user_msg_response, "error") and user_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to store user message")

    # Create AI message entry
    ai_message = {
        "session_id": session_id,
        "content": {"role": "assistant", "content": ""},
    }
    ai_msg_response = supabase.table("chat_messages").insert(ai_message).execute()
    if hasattr(ai_msg_response, "error") and ai_msg_response.error:
        raise HTTPException(status_code=500, detail="Failed to create AI message entry")

    ai_message_id = ai_msg_response.data[0]["id"]
    full_ai_response = ""

    async def generate():
        nonlocal full_ai_response
        try:
            with client.messages.stream(
                max_tokens=1024,
                messages=[*messages, {"role": "user", "content": message}],
                model="claude-3-haiku-20240307",
            ) as stream:
                for text in stream.text_stream:
                    timestamp = datetime.now().isoformat()
                    print(f"[{timestamp}] Sending chunk: {text}")
                    full_ai_response += text
                    yield f"data: {text}\n\n"
                    await asyncio.sleep(0.1)

                # Update the AI message with complete response
                supabase.table("chat_messages").update(
                    {"content": {"role": "assistant", "content": full_ai_response}}
                ).eq("id", ai_message_id).execute()

                yield "data: [END]\n\n"
        except Exception as e:
            print(f"[ERROR] Exception in generate: {str(e)}")
            yield f"data: Error occurred: {str(e)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
