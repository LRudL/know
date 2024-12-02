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
from src.api.ai.make_map import generate_content_map

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


def graph_exists_for_document(document_id: str, client: Client) -> bool:
    result = (
        client.from_("knowledge_graphs")
        .select("*")
        .eq("document_id", document_id)
        .execute()
    )
    return len(result.data) > 0


def get_document_content(document_id: str, client: Client) -> str:
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

    return "ARGLEBARGLE"


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
    print(f"[DEBUG] Running NEW content map route for document {document_id}")
    try:
        # Create client with user's token
        client = get_supabase_client(token)
        doc = get_document_content(document_id, client)

        # Insert new knowledge graph
        graph_id = insert_new_knowledge_graph(document_id, client)

        (nodes, edges) = generate_content_map(graph_id, doc)

        nodes_result = client.from_("graph_nodes").insert(nodes).execute()
        check_data_and_cleanup_on_fail(client, graph_id, nodes_result, "nodes")

        edges_result = client.from_("graph_edges").insert(edges).execute()
        check_data_and_cleanup_on_fail(client, graph_id, edges_result, "edges")

        return {"status": "success", "graph_id": graph_id}
    except Exception as e:
        print(f"[DEBUG] Detailed error: {str(e)}")
        print(f"[DEBUG] Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )


# PRESERVED FOR NOW FOR DEBUGGING:
@router.post("/debug/{document_id}")
async def get_content_map_debug(document_id: str, token: str = Depends(security)):
    print(f"[DEBUG] Getting content map for document {document_id}")
    try:
        # Create client with user's token
        client = get_supabase_client(token)

        # Check if graph already exists
        if graph_exists_for_document(document_id, client):
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Knowledge graph already exists - please delete it first",
                    "document_id": document_id,
                },
            )

        doc_result = (
            client.from_("documents").select("*").eq("id", document_id).execute()
        )
        print(f"[DEBUG] Document query result: {doc_result.data}")

        if not doc_result.data:
            raise HTTPException(
                status_code=404,
                detail={"message": "Document not found", "document_id": document_id},
            )

        document = doc_result.data[0]
        storage_path = document["storage_path"]

        # for testing, just return the storage path
        # return {
        #    "document_id": document_id,
        #    "storage_path": storage_path,
        #    "nodes": [
        #        ContentMapNode(
        #            id="1",
        #            summary="node 1",
        #            content="testing",
        #            supporting_quotes=[
        #                "I returned, and I saw under the sun, that the race is not to the swift"
        #            ],
        #            order_index=0,
        #        ),
        #        ContentMapNode(
        #            id="2",
        #            summary="node 2",
        #            content="testing testing",
        #            supporting_quotes=[],
        #            order_index=1,
        #        ),
        #        ContentMapNode(
        #            id="3",
        #            summary="node 3",
        #            content="testing testing testing",
        #            supporting_quotes=[],
        #            order_index=2,
        #        ),
        #    ],
        #    "edges": [
        #        ContentMapEdge(parent_id="1", child_id="2"),
        #    ],
        # }

        # Create knowledge graph
        graph_result = (
            client.from_("knowledge_graphs")
            .insert({"document_id": document_id})
            .execute()
        )

        if not graph_result.data:
            raise HTTPException(
                status_code=500, detail="Failed to create knowledge graph"
            )

        graph_id = graph_result.data[0]["id"]

        # Create nodes (using the test data for now)
        nodes = [
            {
                "id": f"node_{i+1}",
                "graph_id": graph_id,
                "summary": f"node {i+1}",
                "content": "testing" * (i + 1),
                "supporting_quotes": ["I returned..."] if i == 0 else [],
                "order_index": i,
            }
            for i in range(3)
        ]
        nodes_result = client.from_("graph_nodes").insert(nodes).execute()

        if not nodes_result.data:
            # Cleanup the graph if node creation fails
            client.from_("knowledge_graphs").delete().eq("id", graph_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create nodes")

        # Create edges
        edges = [
            {
                "parent_id": "node_1",
                "child_id": "node_2",
                "graph_id": graph_id,  # Add graph_id to edges
            }
        ]
        edges_result = client.from_("graph_edges").insert(edges).execute()

        if not edges_result.data:
            # Cleanup if edge creation fails
            client.from_("knowledge_graphs").delete().eq("id", graph_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create edges")

        return {"status": "success", "graph_id": graph_id}

    except Exception as e:
        print(f"[DEBUG] Detailed error: {str(e)}")
        print(f"[DEBUG] Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail={"message": str(e), "type": type(e).__name__}
        )
