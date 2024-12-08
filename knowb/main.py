from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import speech
from src.api.routes import learning
from src.api.routes import content_map
from src.services.security import security
from src.api.routes import documents
from src.api.routes import session
from src.api.routes import test
from src.api.routes import tts_routes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # allow_websockets=True
)

# Include routers
app.include_router(documents.router, prefix="/api/documents")
app.include_router(content_map.router, prefix="/api/content_map")
app.include_router(session.router, prefix="/api/chat")
app.include_router(test.router, prefix="/api/test")
app.include_router(learning.router, prefix="/api/learning")
# app.include_router(tts_routes.router)
app.include_router(speech.router, prefix="/api")
