import base64
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import anthropic
import os
from pydantic import BaseModel
from src.services.security import security
from src.services import get_supabase_client
import asyncio
from src.api.ai.prompts import get_session_system_prompt

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

    system_prompt = await get_session_system_prompt(session_id, supabase)
    system_message = {
        "session_id": session_id,
        "content": {
            "role": "user", 
            "content": [
                # {
                #     "type": "document",
                #     "source": {
                #         "type": "base64",
                #         "media_type": "application/pdf",
                #         "data": base64.b64encode(document_content).decode("utf-8")
                #     }  
                # },
                {
                    "type": "text",
                    "text": system_prompt
                }
            ]
        }
    }
    
    messages = [system_message["content"]] + [msg["content"] for msg in history_response.data]
    print(f"[DEBUG] Messages: {messages}")

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
            with client.beta.prompt_caching.messages.stream(
                max_tokens=1024,
                # betas=["pdfs-2024-09-25"],
                messages=[*messages, {"role": "user", "content": message}],
                model="claude-3-5-sonnet-20241022",
            ) as stream:
                for text in stream.text_stream:
                    timestamp = datetime.now().isoformat()
                    print(f"[{timestamp}] Sending chunk: {text}")
                    full_ai_response += text
                    # Replace newlines with escaped newlines and escape any existing escaped newlines
                    safe_text = text.replace("\n", "\\n").replace("\\n", "\\\\n")
                    yield f"data: {safe_text}\n\n"
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
