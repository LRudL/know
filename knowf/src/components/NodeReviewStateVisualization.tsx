import { SpacedRepState } from "@/lib/learningService";
import { dateService } from "@/lib/date";
import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";

interface Props {
  spaced_rep_state: SpacedRepState | null;
}

export function NodeReviewStateVisualization({ spaced_rep_state }: Props) {
  const [currentDate, setCurrentDate] = useState(dateService.now());

  useEffect(() => {
    const unsubscribe = dateService.subscribe((newDate) => {
      setCurrentDate(newDate);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!spaced_rep_state || !spaced_rep_state.next_review) {
    return <div className="text-xs text-gray-500">not yet studied</div>;
  }

  const nextReview = new Date(spaced_rep_state.next_review);
  const isPastDue = nextReview <= currentDate;
  const interval = spaced_rep_state.current_interval.toFixed(1);

  return (
    <div className={`text-xs ${isPastDue ? "text-red-500" : "text-black"}`}>
      <div>
        next: <span className="font-bold">{nextReview.toISOString().replace("T", " ")}</span>
      </div>
      <div>
        interval: <span className="font-semibold">{interval}</span> days
      </div>
    </div>
  );
}
