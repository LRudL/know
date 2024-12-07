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
  status: "processing" | "complete" | "error";
  error_message?: string;
  prompt_id?: string;
}

export class KnowledgeGraphService {
  private static createEmptyGraph(
    id: string,
    status: string,
    error_message?: string,
    prompt_id?: string
  ): KnowledgeGraph {
    return {
      id,
      nodes: [],
      edges: [],
      status: status as "processing" | "complete" | "error",
      error_message,
      prompt_id,
    };
  }

  static async generateGraph(documentId: string): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    try {
      const response = await fetch(`/api/content_map/run/${documentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(120000),
      });

      const data = await response.json().catch(() => ({
        detail: { message: "Internal Server Error" },
      }));

      if (!response.ok) {
        debug.log(
          "[Generate] Request failed but graph may still be processing"
        );
        throw new Error(data.detail?.message || "Failed to generate graph");
      }

      return data.graph_id;
    } catch (error) {
      debug.log(
        "[Generate] Error occurred but graph generation may continue in background"
      );
      throw error;
    }
  }

  static async getGraphForDocument(
    documentId: string
  ): Promise<KnowledgeGraph | null> {
    try {
      const { data: graphs, error: graphError } = await supabase
        .from("knowledge_graphs")
        .select("*")
        .eq("document_id", documentId)
        .maybeSingle();

      if (graphError) throw graphError;
      if (!graphs) return null;

      if (graphs.status === "processing") {
        return this.createEmptyGraph(
          graphs.id,
          graphs.status,
          graphs.error_message
        );
      }

      const { data: nodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select("*")
        .eq("graph_id", graphs.id)
        .order("order_index");

      if (nodesError) throw nodesError;

      const { data: edges, error: edgesError } = await supabase
        .from("graph_edges")
        .select("*")
        .in("parent_id", nodes?.map((n) => n.id) || []);

      if (edgesError) throw edgesError;

      return {
        id: graphs.id,
        nodes: nodes || [],
        edges: edges || [],
        status: graphs.status,
        error_message: graphs.error_message,
        prompt_id: graphs.prompt_id,
      };
    } catch (error) {
      debug.error("Error fetching graph:", error);
      return null;
    }
  }

  static async deleteGraphById(graphId: string): Promise<void> {
    try {
      const { error: edgesError } = await supabase
        .from("graph_edges")
        .delete()
        .eq("graph_id", graphId);

      if (edgesError) throw edgesError;

      const { error: nodesError } = await supabase
        .from("graph_nodes")
        .delete()
        .eq("graph_id", graphId);

      if (nodesError) throw nodesError;

      const { error: graphError } = await supabase
        .from("knowledge_graphs")
        .delete()
        .eq("id", graphId);

      if (graphError) throw graphError;
    } catch (error) {
      debug.error("Error in deleteGraphById:", error);
      throw error;
    }
  }

  static async deleteGraphByDocumentId(documentId: string): Promise<void> {
    try {
      const { data: graph, error: graphFetchError } = await supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("document_id", documentId)
        .single();

      if (graphFetchError) throw graphFetchError;
      if (!graph) return;

      await this.deleteGraphById(graph.id);
    } catch (error) {
      debug.error("Error in deleteGraphByDocumentId:", error);
      throw error;
    }
  }

  static async getGraph(graphId: string): Promise<KnowledgeGraph | null> {
    try {
      if (!graphId || graphId.trim() === "") {
        debug.warn("Invalid graphId provided to getGraph");
        return null;
      }

      const { data: graph, error: graphError } = await supabase
        .from("knowledge_graphs")
        .select("status, error_message")
        .eq("id", graphId)
        .single();

      if (graphError) throw graphError;
      if (!graph) return null;

      if (graph.status === "processing") {
        return this.createEmptyGraph(
          graphId,
          graph.status,
          graph.error_message
        );
      }

      const { data: nodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select("*")
        .eq("graph_id", graphId)
        .order("order_index");

      if (nodesError) throw nodesError;

      const { data: edges, error: edgesError } = await supabase
        .from("graph_edges")
        .select("*")
        .in("parent_id", nodes?.map((n) => n.id) || []);

      if (edgesError) throw edgesError;

      return {
        id: graphId,
        nodes: nodes || [],
        edges: edges || [],
        status: graph.status,
        error_message: graph.error_message,
      };
    } catch (error) {
      debug.error("Error fetching graph:", error);
      return null;
    }
  }

  static async getDocumentIdForGraph(graphId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("knowledge_graphs")
        .select("document_id")
        .eq("id", graphId)
        .single();

      if (error) throw error;
      return data?.document_id || null;
    } catch (error) {
      debug.error("Error getting document ID for graph:", error);
      return null;
    }
  }
}
