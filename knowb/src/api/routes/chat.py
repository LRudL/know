from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import anthropic
import os
from pydantic import BaseModel
from src.services.security import security
import asyncio

router = APIRouter()


class ChatMessage(BaseModel):
    message: str


@router.get("/stream")
async def stream_chat(message: str, token: str = Depends(security)):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def generate():
        try:
            with client.messages.stream(
                max_tokens=1024,
                messages=[{"role": "user", "content": message}],
                model="claude-3-haiku-20240307",
            ) as stream:
                for text in stream.text_stream:
                    timestamp = datetime.now().isoformat()
                    print(f"[{timestamp}] Sending chunk: {text}")
                    yield f"data: {text}\n\n"
                    await asyncio.sleep(0.1)
                # Send a final message to indicate completion
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
