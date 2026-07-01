import { getStore } from "@netlify/blobs";
import type { ReviewState } from "../../src/lib/review/types.js";

export interface ReviewStore {
  getState(): Promise<ReviewState | null>;
  setState(state: ReviewState): Promise<void>;
}

export function blobsReviewStore(): ReviewStore {
  // `consistency: 'strong'` so the owner sees their own write immediately.
  const store = getStore({ name: "review", consistency: "strong" });
  return {
    async getState() {
      const v = await store.get("state", { type: "json" });
      return (v as ReviewState | null) ?? null;
    },
    async setState(state) {
      await store.setJSON("state", state);
    },
  };
}
