import { SpacedRepState } from "@/lib/learningService";
import { dateService } from "@/lib/date";

interface Props {
  spaced_rep_state: SpacedRepState | null;
}

export function NodeReviewStateVisualization({ spaced_rep_state }: Props) {
  if (!spaced_rep_state || !spaced_rep_state.next_review) {
    return <div className="text-xs text-gray-500">no reviews</div>;
  }

  const nextReview = new Date(spaced_rep_state.next_review);
  const now = dateService.now();
  const isPastDue = nextReview <= now;

  return (
    <div className={`text-xs ${isPastDue ? "text-red-500" : "text-blue-500"}`}>
      next: {nextReview.toLocaleString()}
    </div>
  );
}
