import React from "react";
import { dateService } from "../lib/date";
import { debug } from "@/lib/debug";
import { LearningService } from "@/lib/learningService";
import { useQueryClient } from "@tanstack/react-query";

interface MockReviewProps {
  nodeId: string;
  graphId: string;
}

export const MockReview: React.FC<MockReviewProps> = ({ nodeId, graphId }) => {
  const queryClient = useQueryClient();

  const handleReview = async (quality: "failed" | "hard" | "good" | "easy") => {
    const updateRequest = {
      node_id: nodeId,
      graph_id: graphId,
      user_id: "TODO", // This is ignored on backend as it uses the auth token
      message_id: null,
      created_at: dateService.now().toISOString(),
      update_data: {
        quality,
        notes: null,
      },
    };

    try {
      await LearningService.updateLearningProgress(updateRequest);
      // Invalidate and refetch the learning state
      await queryClient.invalidateQueries({
        queryKey: ["learningState", graphId],
      });
    } catch (error) {
      debug.error("Failed to update learning progress:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await LearningService.deleteLearningProgress(graphId, nodeId);
      // Invalidate and refetch the learning state
      await queryClient.invalidateQueries({
        queryKey: ["learningState", graphId],
      });
    } catch (error) {
      debug.error("Failed to delete learning progress:", error);
    }
  };

  return (
    <div className="flex gap-1 mt-1">
      <button
        onClick={() => handleReview("failed")}
        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
      >
        Failed
      </button>
      <button
        onClick={() => handleReview("hard")}
        className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
      >
        Hard
      </button>
      <button
        onClick={() => handleReview("good")}
        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
      >
        Good
      </button>
      <button
        onClick={() => handleReview("easy")}
        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Easy
      </button>
      <button
        onClick={handleDelete}
        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        Reset
      </button>
    </div>
  );
};
