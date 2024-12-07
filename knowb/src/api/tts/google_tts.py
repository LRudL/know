from google.cloud import texttospeech
from google.api_core import client_options
import os
from dotenv import load_dotenv

load_dotenv()

# This is a temporary class for testing the TTS through Google. 
# Note that appropriate API keys are still not configured
class TTSService:
    def __init__(self):
        api_key = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        
        if not api_key:
            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")
            
        # Configure client with API key
        options = client_options.ClientOptions(
            api_key=api_key
        )
        
        self.client = texttospeech.TextToSpeechClient(client_options=options)
        
    async def stream_text_to_speech(self, text: str):
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Standard-A",
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
            pitch=0.0
        )
        
        try:
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            return response.audio_content
        except Exception as e:
            print(f"Error in TTS synthesis: {e}")
            raise