from datetime import datetime, timedelta
import random
from typing import Literal, Optional, List, Tuple
from pydantic import BaseModel, Field

from src.api.models import SpacedRepState, LearningProgressUpdate, REVIEW_QUALITY_LABEL


def apply_learning_update(
    state: SpacedRepState, learning_update: LearningProgressUpdate, date: datetime
) -> SpacedRepState:
    print(
        f"[DEBUG] Initial state: interval={state.current_interval}, ease={state.ease_factor}"
    )

    last_review_quality = learning_update.update_data.quality
    new_ease = state.ease_factor

    if len(state.review_history) == 0:
        # new card
        if last_review_quality == "failed":
            new_interval = 0.5
        elif last_review_quality == "easy":
            new_interval = 4
        else:
            new_interval = 1
    else:
        # card has already been reviewed
        assert state.current_interval > 0, "Current interval should be greater than 0"

        if last_review_quality == "failed":
            new_ease = max(1.3, state.ease_factor - 0.2)
            new_interval = 1

        elif last_review_quality == "hard":
            new_interval = state.current_interval * state.ease_factor * 0.8
            new_ease = max(1.3, state.ease_factor - 0.15)

        elif last_review_quality == "good":
            new_interval = state.current_interval * state.ease_factor

        elif last_review_quality == "easy":
            new_interval = state.current_interval * state.ease_factor * 1.3
            new_ease = min(2.8, state.ease_factor + 0.15)

    # Apply fuzzy factor
    fuzzy_factor = 1 + random.uniform(-0.05, 0.05)
    new_interval *= fuzzy_factor

    new_interval = max(1 / 24, new_interval)  # interval doesn't drop below 1h

    next_review = date + timedelta(days=new_interval)

    return SpacedRepState(
        next_review=next_review,
        last_review=date,
        current_interval=new_interval,
        ease_factor=new_ease,
        review_history=state.review_history + [(date, learning_update.update_data)],
    )


# example anki algorithm from Claude:

"""
class Card:
    ease = 2.5  # Starting ease factor
    interval = 0  # Days until next review
    step = 0  # Position in learning steps
    lapses = 0  # Number of times forgotten


def review_card(card, rating):  # rating from 0-4
    if rating < 2:  # Failed
        card.lapses += 1
        card.ease = max(1.3, card.ease - 0.2)  # Reduce ease but not below floor

        if card.interval > 4:  # If it's a mature card
            card.interval *= 0.25  # Reduce to 25% of previous
        else:
            card.interval = 0  # Back to learning steps
            card.step = 0
        return

    # Passed
    if card.interval == 0:  # In learning
        learning_steps = [1, 10]  # Minutes
        card.step += 1
        if card.step >= len(learning_steps):
            card.interval = 1  # Graduate to review
        else:
            card.interval = learning_steps[card.step] / 1440  # Convert to days
        return

    # Regular review success
    if rating == 2:  # Hard
        card.interval *= card.ease * 0.8
        card.ease = max(1.3, card.ease - 0.15)
    elif rating == 3:  # Good
        card.interval *= card.ease
    else:  # Easy
        card.interval *= card.ease * 1.3
        card.ease = min(2.8, card.ease + 0.15)

    # Apply fuzzy factor to avoid cards syncing up
    card.interval *= 1 + random.uniform(-0.05, 0.05)
"""
