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
}
