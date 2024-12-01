from dataclasses import dataclass
import traceback
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.services import get_supabase_client, supabase
from src.services.security import security, get_user_id_from_token

router = APIRouter()


# these dataclasses are based on the database structure
@dataclass
class ContentMapNode:
    id: str
    summary: str
    content: str
    supporting_quotes: list[str]
    order_index: int


@dataclass
class ContentMapEdge:
    parent_id: str
    child_id: str


@router.post("/{document_id}")
async def get_content_map(document_id: str, token: str = Depends(security)):
    print(f"[DEBUG] Getting content map for document {document_id}")
    try:
        # Create client with user's token
        client = get_supabase_client(token)

        # Query will be automatically filtered by RLS
        result = client.from_("documents").select("*").eq("id", document_id).execute()
        print(f"[DEBUG] Query result: {result.data}")

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail={"message": "Document not found", "document_id": document_id},
            )

        document = result.data[0]
        storage_path = document["storage_path"]

        # for testing, just return the storage path
        return {
            "document_id": document_id,
            "storage_path": storage_path,
            "nodes": [
                ContentMapNode(
                    id="1",
                    summary="node 1",
                    content="testing",
                    supporting_quotes=[
                        "I returned, and I saw under the sun, that the race is not to the swift"
                    ],
                    order_index=0,
                ),
                ContentMapNode(
                    id="2",
                    summary="node 2",
                    content="testing testing",
                    supporting_quotes=[],
                    order_index=1,
                ),
                ContentMapNode(
                    id="3",
                    summary="node 3",
                    content="testing testing testing",
                    supporting_quotes=[],
                    order_index=2,
                ),
            ],
            "edges": [
                ContentMapEdge(parent_id="1", child_id="2"),
            ],
        }

    except Exception as e:
        print(f"[DEBUG] Detailed error: {str(e)}")
        print(f"[DEBUG] Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )
