import React from "react";
import { dateService } from "../lib/date";
import { debug } from "@/lib/debug";

type ReviewQuality = "failed" | "hard" | "good" | "easy";

interface MockReviewProps {
  nodeId: string;
  graphId: string;
}

export const MockReview: React.FC<MockReviewProps> = ({ nodeId, graphId }) => {
  const handleReview = (quality: ReviewQuality) => {
    const updateRequest = {
      node_id: nodeId,
      graph_id: graphId,
      user_id: "TODO", // This is done on the backend based on the auth token.
      message_id: null,
      created_at: dateService.now().toISOString(),
      update_data: {
        quality,
        notes: null,
      },
    };

    debug.log("Learning progress update:", updateRequest);
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
    </div>
  );
};
