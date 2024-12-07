from fastapi import APIRouter, WebSocket
from src.api.tts.google_tts import TTSService
import json

router = APIRouter()
tts_service = TTSService()

# Route for TTS through Google cloud
@router.websocket("/ws/tts")
async def websocket_endpoint(websocket: WebSocket):
    print("[TTS] New WebSocket connection established")
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_text()
            text_chunk = json.loads(data)["text"]
            print(f"[TTS] Received text chunk for TTS: {text_chunk[:50]}...")  # First 50 chars
            
            print("[TTS] Calling Google TTS API")
            audio_content = await tts_service.stream_text_to_speech(text_chunk)
            print(f"[TTS] Received audio content of size: {len(audio_content)} bytes")
            
            await websocket.send_bytes(audio_content)
            print("[TTS] Sent audio content to client")
            
    except Exception as e:
        print(f"[TTS] WebSocket error: {str(e)}")
        await websocket.close()