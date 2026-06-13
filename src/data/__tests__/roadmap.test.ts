import { describe, it, expect } from "vitest";
import {
  roadmap,
  allTaskIds,
  allLogIds,
  allIds,
  deriveStats,
} from "../roadmap.js";

describe("roadmap content", () => {
  it("exposes six milestones", () => {
    expect(roadmap).toHaveLength(6);
  });

  it("has unique IDs across all tasks and logs", () => {
    const ids = [...allTaskIds, ...allLogIds];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds allIds as the union of task and log IDs", () => {
    expect(allIds.size).toBe(allTaskIds.length + allLogIds.length);
  });

  it("includes the known M1/W1 task and log IDs", () => {
    expect(allIds.has("m1.w1.mon")).toBe(true);
    expect(allIds.has("m1.w1.log")).toBe(true);
  });

  it("current content has 9 tasks and 2 logs (update when M2+ weeks are filled)", () => {
    expect(allTaskIds).toHaveLength(9);
    expect(allLogIds).toHaveLength(2);
  });
});

describe("deriveStats", () => {
  it("reports zero progress for an empty completed list", () => {
    const s = deriveStats([]);
    expect(s.pct).toBe(0);
    expect(s.tasksDone).toBe(0);
    expect(s.tasksTotal).toBe(allTaskIds.length);
    expect(s.logsDone).toBe(0);
    expect(s.logsTotal).toBe(allLogIds.length);
  });

  it("counts completed tasks and logs and ignores unknown IDs", () => {
    const s = deriveStats(["m1.w1.mon", "m1.w1.log", "does.not.exist"]);
    expect(s.tasksDone).toBe(1);
    expect(s.logsDone).toBe(1);
    expect(s.perMilestone.m1).toBeGreaterThan(0);
  });

  it("computes planned hours as 180 (weeks + milestone estimates)", () => {
    expect(deriveStats([]).plannedHours).toBe(180);
  });
});
