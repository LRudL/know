from dataclasses import dataclass
import traceback
from supabase import Client
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from postgrest import APIResponse
from src.services import get_supabase_client, supabase
from src.services.security import security, get_user_id_from_token
from src.api.ai.make_map import make_content_map
import logging

router = APIRouter()


def graph_exists_for_document(document_id: str, client: Client) -> bool:
    result = (
        client.from_("knowledge_graphs")
        .select("*")
        .eq("document_id", document_id)
        .execute()
    )
    return len(result.data) > 0


def get_document_content(document_id: str, client: Client) -> bytes:
    # Check if graph already exists
    if graph_exists_for_document(document_id, client):
        raise HTTPException(
            status_code=400,
            detail={"message": "Knowledge graph already exists"},
        )

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


def insert_new_knowledge_graph(document_id: str, client: Client) -> str:
    graph_result = (
        client.from_("knowledge_graphs").insert({"document_id": document_id}).execute()
    )
    if not graph_result.data:
        raise HTTPException(status_code=500, detail="Failed to create knowledge graph")
    return graph_result.data[0]["id"]


def check_data_and_cleanup_on_fail(
    client: Client, graph_id: str, result: APIResponse, name: str
):
    if not result.data:
        client.from_("knowledge_graphs").delete().eq("id", graph_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to create {name}")


@router.post("/run/{document_id}")
async def run_content_map(document_id: str, token: str = Depends(security)):
    try:
        # Create client with user's token
        client = get_supabase_client(token)
        doc = get_document_content(document_id, client)

        # Insert new knowledge graph
        graph_id = insert_new_knowledge_graph(document_id, client)

        (nodes, edges) = make_content_map(doc)

        # Convert nodes to dictionaries and add graph_id
        nodes_data = [{**vars(node), "graph_id": graph_id} for node in nodes]

        # Convert edges to dictionaries and add graph_id
        edges_data = [{**vars(edge), "graph_id": graph_id} for edge in edges]

        nodes_result = client.from_("graph_nodes").insert(nodes_data).execute()
        check_data_and_cleanup_on_fail(client, graph_id, nodes_result, "nodes")

        edges_result = client.from_("graph_edges").insert(edges_data).execute()
        check_data_and_cleanup_on_fail(client, graph_id, edges_result, "edges")

        return {"status": "success", "graph_id": graph_id}
    except Exception as e:
        print(f"[DEBUG] Detailed error: {str(e)}")
        print(f"[DEBUG] Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )
