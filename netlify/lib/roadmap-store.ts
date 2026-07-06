import { getStore } from "@netlify/blobs";
import type { LogEntry } from "../../src/data/roadmap.js";

export type { LogEntry };

export interface ProgressBlob {
  version: 2;
  updatedAt: string; // ISO
  completed: string[]; // task & log IDs
  logEntries: Record<string, LogEntry>; // decision-log prose, keyed by log ID
}

export interface RoadmapStore {
  getProgress(): Promise<ProgressBlob | null>;
  setProgress(blob: ProgressBlob): Promise<void>;
}

export function blobsRoadmapStore(): RoadmapStore {
  // `consistency: 'strong'` so the owner sees their own write immediately.
  const store = getStore({ name: "roadmap", consistency: "strong" });
  return {
    async getProgress() {
      const v = await store.get("progress", { type: "json" });
      return (v as ProgressBlob | null) ?? null;
    },
    async setProgress(blob) {
      await store.setJSON("progress", blob);
    },
  };
}
