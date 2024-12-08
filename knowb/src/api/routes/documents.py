from io import BytesIO
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client
from src.services import get_supabase_client, supabase
from src.services.security import security, get_user_id_from_token

router = APIRouter()


"""
@router.get("/")
async def get_documents(token: str = Depends(security)):
    try:
        # Use user-specific client
        client = get_supabase_client(token.credentials)
        result = client.table("documents").select("*").execute()
        print(f"[DEBUG] Documents query result: {result.data}")

        return {"count": len(result.data), "documents": result.data}
    except Exception as e:
        print(f"[DEBUG] Error in get_documents: {str(e)}")
        raise

@router.get("/user_document_content/{document_id}")
async def get_user_document_content(document_id: str, token: str = Depends(security)):
    # Version that uses user's token instead of service role
    try:
        # Create client with user's token
        client = get_supabase_client(token)

        # Query will be automatically filtered by RLS
        result = client.from_("documents").select("*").eq("id", document_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")

        document = result.data[0]
        storage_path = document["storage_path"]

        # Use user's token for storage access
        file_data = client.storage.from_("documents").download(storage_path)

        return StreamingResponse(BytesIO(file_data), media_type="application/pdf")

    except Exception as e:
        print(f"[DEBUG] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/document_content")
async def get_document_content(document_id: str, token: str = Depends(security)):
    try:
        user_id = get_user_id_from_token(token)

        # Get document metadata
        result = (
            supabase.from_("documents")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")

        document = result.data[0]
        storage_path = document["storage_path"]

        print(f"[DEBUG] Attempting to download from path: {storage_path}")

        # Get the actual file content from storage
        try:
            file_data = supabase.storage.from_("documents").download(storage_path)
            print(f"[DEBUG] File downloaded successfully, size: {len(file_data)}")
            return file_data
        except Exception as e:
            print(f"[DEBUG] Storage error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

    except Exception as e:
        print(f"[DEBUG] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class KnowledgeMapRequest(BaseModel):
    documentId: str

"""


@router.get("/debug/user_id")
async def get_user_id(token: str = Depends(security)):
    user_id = get_user_id_from_token(token)
    return {"user_id": user_id}


def get_document_content(document_id: str, client: Client) -> bytes:
    # Get the document
    doc_result = client.from_("documents").select("*").eq("id", document_id).execute()
    if not doc_result.data:
        raise HTTPException(
            status_code=404,
            detail={"message": "Document not found", "document_id": document_id},
        )

    # download document
    document = doc_result.data[0]
    storage_path = document["storage_path"]

    try:
        response = client.storage.from_("documents").download(storage_path)

        logging.debug(f"Supabase response type: {type(response)}")

        # Convert response to bytes if it isn't already
        if isinstance(response, bytes):
            content = response
        elif hasattr(response, "read"):
            content = response.read()
        else:
            raise ValueError(f"Unexpected response type: {type(response)}")

        # Verify we got valid PDF content
        logging.debug(f"Downloaded content length: {len(content)} bytes")
        logging.debug(f"Content starts with: {content[:20]}")

        if not content.startswith(b"%PDF"):
            logging.error("Downloaded content is not a valid PDF!")
            logging.debug(f"Content starts with: {content[:50]}")
            raise ValueError("Invalid PDF content")

        return content

    except Exception as e:
        logging.error(f"Document download error: {str(e)}")
        logging.error(f"Response type: {type(response)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Failed to download document: {str(e)}"},
        )
