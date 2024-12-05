from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from src.services.security import security
import asyncio

router = APIRouter()


# This is a test endpoint for debugging backend streaming in a maximally-simple way.


@router.get("/stream")
async def stream(token: str = Depends(security)):
    async def event_generator():
        for i in range(5):
            yield f"data: Message {i}\n\n"
            print(f"Sending message {i}")
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
