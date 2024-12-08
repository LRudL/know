import React from "react";
import { dateService } from "../lib/date";
import { debug } from "@/lib/debug";
import { LearningService } from "@/lib/learningService";
import { useQueryClient } from "@tanstack/react-query";
import { Flex, Text } from "@radix-ui/themes";

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
    <Flex direction="column" gap="1" className="mt-4">
      <Text size="1" color="gray">Mock Learning</Text>
      <div className="flex gap-1">
        <button
          onClick={() => handleReview("failed")}
          className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Failed
        </button>
        <button
          onClick={() => handleReview("hard")}
          className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
        >
          Hard
        </button>
        <button
          onClick={() => handleReview("good")}
          className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          Good
        </button>
        <button
          onClick={() => handleReview("easy")}
          className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Easy
        </button>
        <button
          onClick={handleDelete}
          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Reset
        </button>
      </div>
    </Flex>
  );
};
