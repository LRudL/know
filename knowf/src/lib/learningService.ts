import { supabase } from "@/lib/supabase";
import { debug } from "@/lib/debug";
import { KnowledgeGraphNode } from "./graphService";

// Types matching the backend models
export interface SpacedRepState {
  next_review: string | null;
  last_review: string | null;
  current_interval: number;
  ease_factor: number;
  review_history: any[]; // Can be typed more specifically if needed
}

export interface NodeState {
  node: KnowledgeGraphNode;
  spaced_rep_state: SpacedRepState | null;
}

export interface GraphLearningState {
  past: NodeState[];
  to_review: NodeState[];
  not_yet_learned: NodeState[];
}

interface LearningProgressUpdateRequest {
  node_id: string;
  graph_id: string;
  user_id: string; // This will be ignored on backend as it uses the auth token
  message_id: string | null;
  created_at: string;
  update_data: {
    quality: "failed" | "hard" | "good" | "easy";
    notes: string | null;
  };
}

export class LearningService {
  static async getGraphLearningState(
    graphId: string,
    date: Date
  ): Promise<GraphLearningState> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    try {
      const response = await fetch(
        `/api/learning/get_graph_learning_state/${graphId}?date=${date.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.detail?.message || "Failed to fetch learning state"
        );
      }

      const data = await response.json();
      debug.log("Learning state:", data);
      return data as GraphLearningState;
    } catch (error) {
      debug.error("Error fetching graph learning state:", error);
      throw error;
    }
  }

  static async updateLearningProgress(
    request: LearningProgressUpdateRequest
  ): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    try {
      debug.log("Sending learning update request:", request);

      // Validate required fields before sending
      if (!request.graph_id) {
        throw new Error("graph_id is required but was undefined");
      }
      if (!request.node_id) {
        throw new Error("node_id is required but was undefined");
      }
      if (!request.update_data) {
        throw new Error("update_data is required but was undefined");
      }
      if (!request.created_at) {
        throw new Error("created_at is required but was undefined");
      }
      if (!request.update_data.quality) {
        throw new Error("update_data.quality is required but was undefined");
      }

      const response = await fetch("/api/learning/learning_update", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request), // Send the entire request
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Format validation errors nicely
        if (errorData.detail && Array.isArray(errorData.detail)) {
          const errors = errorData.detail
            .map((error: any) => `${error.msg} at ${error.loc.join(".")}`)
            .join(", ");
          throw new Error(`Validation error: ${errors}`);
        }
        throw new Error(`Server error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      debug.log("Learning progress update response:", data);
    } catch (error) {
      debug.error("Error updating learning progress:", error);
      throw error;
    }
  }

  static async deleteLearningProgress(
    graphId: string,
    nodeId: string
  ): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    try {
      const response = await fetch(`/api/learning/learning_delete/${nodeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server error: ${JSON.stringify(errorData)}`);
      }

      debug.log("Learning progress deleted successfully");
    } catch (error) {
      debug.error("Error deleting learning progress:", error);
      throw error;
    }
  }
}
