from supabase import Client


def session_id_to_document_id(session_id: str, client: Client) -> str:
    """Get the document id for a session"""
    document_id_result = client.table("chat_sessions").select("document_id").eq("id", session_id).execute()
    return document_id_result.data[0]["document_id"]

def document_id_to_graph_id(document_id: str, client: Client) -> str:
    """Get the graph id for a document"""
    graph_id_result = client.table("knowledge_graphs").select("id").eq("document_id", document_id).order("created_at", desc=True).execute()
    return graph_id_result.data[0]["id"]

def session_id_to_graph_id(session_id: str, client: Client) -> str:
    """Get the graph id for a session"""
    document_id = session_id_to_document_id(session_id, client)
    return document_id_to_graph_id(document_id, client)

def graph_id_and_node_order_index_to_node_id(graph_id: str, node_order_index: int, client: Client) -> str:
    """Get the node id for a graph and node order index"""
    node_id_result = client.table("graph_nodes").select("id").eq("graph_id", graph_id).eq("order_index", node_order_index).execute()
    return node_id_result.data[0]["id"]