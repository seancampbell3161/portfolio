// Private review-state types (SM-2 schedule + streak). Storage-agnostic: the
// same shapes serialize to Netlify Blobs on the server and hydrate the client.

export interface CardSchedule {
  ease: number; // default 2.5, floor 1.3, no ceiling
  interval: number; // days until next due; 0 => due again this session
  due: string; // "YYYY-MM-DD" (local)
  reps: number; // consecutive successful reps
  lapses: number;
  lastReviewed?: string;
}

export interface ReviewState {
  schedules: Record<string, CardSchedule>; // keyed by ReviewCard.id
  streak: number;
  lastReviewDate: string | null; // "YYYY-MM-DD"
}

export type Rating = 0 | 1 | 2 | 3; // Again · Hard · Good · Easy

export const emptyReviewState = (): ReviewState => ({
  schedules: {},
  streak: 0,
  lastReviewDate: null,
});
