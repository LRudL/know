from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import base64
import os
import requests
from src.services.security import security

router = APIRouter()

class SpeechRequest(BaseModel):
    audio: str
    session_id: str  # Add session_id to match chat infrastructure

@router.post("/speech-to-text")
async def speech_to_text(request: SpeechRequest, token: str = Depends(security)):
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)
        
        # Google Speech-to-Text API endpoint
        url = "https://speech.googleapis.com/v1/speech:recognize"
        
        # Request payload
        payload = {
            "config": {
                "encoding": "WEBM_OPUS",
                "sampleRateHertz": 48000,
                "languageCode": "en-GB",
                "model": "default"
            },
            "audio": {
                "content": base64.b64encode(audio_bytes).decode('utf-8')
            }
        }
        
        # Make request to Google API
        response = requests.post(
            url,
            json=payload,
            params={"key": os.getenv("GOOGLE_API_KEY")},
        )
        
        if not response.ok:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Google API error: {response.text}"
            )
        
        result = response.json()
        
        # Extract transcript
        transcript = ""
        if "results" in result:
            for result in result["results"]:
                if "alternatives" in result and result["alternatives"]:
                    transcript += result["alternatives"][0]["transcript"]
        
        # The transcript will be sent back to the frontend
        # where it will be automatically fed into the chat flow
        return {"text": transcript}
        
    except Exception as e:
        print(f"Error in speech-to-text: {str(e)}")  # For debugging
        raise HTTPException(status_code=500, detail=str(e))
