from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import content_map
from src.services.security import security
from src.api.routes import documents

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/documents")
app.include_router(content_map.router, prefix="/api/content_map")
