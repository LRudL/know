from supabase import Client
from datetime import datetime
from fastapi import HTTPException

"""
READING
"""
def session_id_to_document_id(session_id: str, client: Client) -> str:
    """Get the document id for a session"""
    document_id_result = client.table("chat_sessions").select("document_id").eq("id", session_id).execute()
    assert len(document_id_result.data) == 1, "Expected exactly one document id for a session"
    return document_id_result.data[0]["document_id"]

def document_id_to_graph_id(document_id: str, client: Client) -> str:
    """Get the graph id for a document"""
    graph_id_result = client.table("knowledge_graphs").select("id").eq("document_id", document_id).order("created_at", desc=True).execute()
    assert len(graph_id_result.data) == 1, "Expected exactly one graph id for a document"
    return graph_id_result.data[0]["id"]

def session_id_to_graph_id(session_id: str, client: Client) -> str:
    """Get the graph id for a session"""
    document_id = session_id_to_document_id(session_id, client)
    return document_id_to_graph_id(document_id, client)

def graph_id_and_node_order_index_to_node_id(graph_id: str, node_order_index: int, client: Client) -> str:
    """Get the node id for a graph and node order index"""
    node_id_result = client.table("graph_nodes").select("id").eq("graph_id", graph_id).eq("order_index", node_order_index).execute()
    assert len(node_id_result.data) == 1, "Expected exactly one node id for a graph and node order index"
    return node_id_result.data[0]["id"]

async def get_chat_history(session_id: str, client: Client) -> list:
    """Fetch chat history for a session."""
    response = (
        client.table("chat_messages")
        .select("content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    if hasattr(response, "error") and response.error:
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")
    return [msg["content"] for msg in response.data]

"""
WRITING
"""

def wrap_message(session_id: str, message: dict) -> dict:
    """Wrap a message with session_id for storage"""
    return {
        "session_id": session_id,
        "content": message,
    }

async def store_chat_message(session_id: str, message: dict, client: Client) -> str:
    """Store a chat message and return its ID."""
    response = (
        client.table("chat_messages")
        .insert(wrap_message(session_id, message))
        .execute()
    )
    if hasattr(response, "error") and response.error:
        raise HTTPException(status_code=500, detail="Failed to store message")
    return response.data[0]["id"]
