import type { CardSchedule, Rating, ReviewState } from "./types";

export const todayStr = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

export const addDays = (dateStr: string, n: number): string => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const EASE_FLOOR = 1.3;

// Deterministic SM-2 variant. Ratings: 0 Again · 1 Hard · 2 Good · 3 Easy.
// Again => interval 0 => due today, so the card re-queues in the same session.
export function schedule(s: CardSchedule, rating: Rating, today: string = todayStr()): CardSchedule {
  let { ease, interval, reps, lapses } = s;
  if (rating === 0) {
    ease = Math.max(EASE_FLOOR, ease - 0.2);
    interval = 0;
    reps = 0;
    lapses += 1;
  } else if (rating === 1) {
    ease = Math.max(EASE_FLOOR, ease - 0.15);
    interval = Math.max(1, Math.round((interval || 1) * 1.2));
    reps += 1;
  } else if (rating === 2) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round((interval || 1) * ease);
    reps += 1;
  } else {
    ease = ease + 0.15;
    interval = Math.round((interval || 1) * ease * 1.3);
    reps += 1;
  }
  return { ease, interval, reps, lapses, due: addDays(today, interval), lastReviewed: today };
}

// Streak, pure. Caller assigns the result back onto the state.
export function updateStreak(
  state: ReviewState,
  today: string = todayStr(),
): { streak: number; lastReviewDate: string } {
  if (state.lastReviewDate === today) {
    return { streak: state.streak, lastReviewDate: today };
  }
  const yesterday = addDays(today, -1);
  const streak = state.lastReviewDate === yesterday ? state.streak + 1 : 1;
  return { streak, lastReviewDate: today };
}

// A broken streak reads as 0 without mutating stored state.
export function displayStreak(state: ReviewState, today: string = todayStr()): number {
  if (state.lastReviewDate === today || state.lastReviewDate === addDays(today, -1)) {
    return state.streak;
  }
  return 0;
}
