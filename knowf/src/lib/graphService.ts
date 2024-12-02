import { supabase } from "@/lib/supabase";
import { debug } from "@/lib/debug";

export interface KnowledgeGraphNode {
  id: string;
  summary: string;
  content: string;
  supporting_quotes: string[];
  order_index: number;
}

export interface KnowledgeGraphEdge {
  parent_id: string;
  child_id: string;
}

export interface KnowledgeGraph {
  id: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export class KnowledgeGraphService {
  static async generateGraph(documentId: string): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    const response = await fetch(`/api/content_map/${documentId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || "Failed to generate graph");
    }
  }

  static async getGraphForDocument(
    documentId: string
  ): Promise<KnowledgeGraph | null> {
    try {
      // First get the knowledge graph
      const { data: graphs, error: graphError } = await supabase
        .from("knowledge_graphs")
        .select("*")
        .eq("document_id", documentId)
        .maybeSingle(); // IMPORTANT: This is needed because the graph might not exist

      if (graphError) throw graphError;
      if (!graphs) return null;

      // Get nodes
      const { data: nodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select("*")
        .eq("graph_id", graphs.id)
        .order("order_index");

      if (nodesError) throw nodesError;

      // Get edges - modified to use node IDs from the nodes we just fetched
      const { data: edges, error: edgesError } = await supabase
        .from("graph_edges")
        .select("*")
        .in("parent_id", nodes?.map((n) => n.id) || []);

      if (edgesError) throw edgesError;

      return {
        id: graphs.id,
        nodes: nodes || [],
        edges: edges || [],
      };
    } catch (error) {
      debug.error("Error fetching graph:", error);
      return null;
    }
  }

  static async deleteGraph(documentId: string): Promise<void> {
    try {
      debug.log("Attempting to delete graph for document:", documentId);

      // First get the graph ID
      const { data: graph, error: graphFetchError } = await supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("document_id", documentId)
        .single();

      if (graphFetchError) {
        debug.error("Error fetching graph:", graphFetchError);
        throw graphFetchError;
      }

      if (!graph) {
        debug.error("No graph found for document:", documentId);
        return;
      }

      debug.log("Found graph with ID:", graph.id);

      // Delete edges first
      const { data: deletedEdges, error: edgesError } = await supabase
        .from("graph_edges")
        .delete()
        .eq("graph_id", graph.id)
        .select();

      if (edgesError) {
        debug.error("Error deleting edges:", edgesError);
        throw edgesError;
      }
      debug.log("Deleted edges:", deletedEdges);

      // Delete nodes
      const { data: deletedNodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .delete()
        .eq("graph_id", graph.id)
        .select();

      if (nodesError) {
        debug.error("Error deleting nodes:", nodesError);
        throw nodesError;
      }
      debug.log("Deleted nodes:", deletedNodes);

      // Finally delete the graph
      const { data: deletedGraph, error: graphError } = await supabase
        .from("knowledge_graphs")
        .delete()
        .eq("id", graph.id)
        .select();

      if (graphError) {
        debug.error("Error deleting graph:", graphError);
        throw graphError;
      }
      debug.log("Deleted graph:", deletedGraph);

      debug.log("Graph and related data deleted successfully");
    } catch (error) {
      debug.error("Error in deleteGraph:", error);
      throw error;
    }
  }

  static async getGraph(graphId: string): Promise<KnowledgeGraph | null> {
    try {
      // Early return if graphId is empty or invalid
      if (!graphId || graphId.trim() === "") {
        debug.warn("Invalid graphId provided to getGraph");
        return null;
      }

      // Get nodes
      const { data: nodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select("*")
        .eq("graph_id", graphId)
        .order("order_index");

      if (nodesError) throw nodesError;

      // Get edges
      const { data: edges, error: edgesError } = await supabase
        .from("graph_edges")
        .select("*")
        .in("parent_id", nodes?.map((n) => n.id) || []);

      if (edgesError) throw edgesError;

      return {
        id: graphId,
        nodes: nodes || [],
        edges: edges || [],
      };
    } catch (error) {
      debug.error("Error fetching graph:", error);
      return null;
    }
  }
}
