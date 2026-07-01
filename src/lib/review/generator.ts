import type { ReviewCard } from "../../data/review-cards";
import type { CardSchedule, ReviewState } from "./types";
import { todayStr } from "./sm2";

export interface DueCard {
  card: ReviewCard;
  sched: CardSchedule;
}

// A card absent from state.schedules is new: due the moment it unlocks.
const defaultSchedule = (today: string): CardSchedule => ({
  ease: 2.5,
  interval: 0,
  reps: 0,
  lapses: 0,
  due: today,
});

export function unlockedCards(cards: ReviewCard[], completedIds: Set<string>): ReviewCard[] {
  return cards.filter((c) => !c.sourceId || completedIds.has(c.sourceId));
}

export function dueCards(
  cards: ReviewCard[],
  completedIds: Set<string>,
  state: ReviewState,
  today: string = todayStr(),
): DueCard[] {
  return unlockedCards(cards, completedIds)
    .map((card) => ({ card, sched: state.schedules[card.id] ?? defaultSchedule(today) }))
    .filter((x) => x.sched.due <= today)
    .sort((a, b) => a.sched.due.localeCompare(b.sched.due));
}

// The single point that knows the public progress shape ({ completed: string[] }).
export function completedIdsFromProgress(
  progress: { completed?: string[] } | null | undefined,
): Set<string> {
  return new Set(progress?.completed ?? []);
}
