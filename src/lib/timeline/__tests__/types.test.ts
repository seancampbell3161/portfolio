import { describe, it, expect } from "vitest";
import {
  deriveKind,
  assertUniqueIds,
  projectFrontmatterSchema,
  timelineEntrySchema,
  communityEntrySchema,
  learningEntrySchema,
} from "../types.js";

const d = (s: string) => new Date(s);

describe("deriveKind", () => {
  it("is a span when end is present", () => {
    expect(deriveKind("done", d("2025-01-01"))).toBe("span");
    expect(deriveKind("live", d("2025-01-01"))).toBe("span");
  });
  it("is a span when in progress with no end", () => {
    expect(deriveKind("in-progress")).toBe("span");
  });
  it("is a moment when done or live with no end", () => {
    expect(deriveKind("done")).toBe("moment");
    expect(deriveKind("live")).toBe("moment");
  });
});

describe("assertUniqueIds", () => {
  it("passes on unique ids", () => {
    expect(() => assertUniqueIds([{ id: "a" }, { id: "b" }])).not.toThrow();
  });
  it("names the duplicate", () => {
    expect(() => assertUniqueIds([{ id: "a" }, { id: "a" }])).toThrow(
      "Duplicate timeline id: a",
    );
  });
});

describe("projectFrontmatterSchema", () => {
  const ok = {
    title: "Roaming.Camp",
    description: "Campsite discovery.",
    start: "2025-03-01",
    end: "2026-06-30",
    status: "live",
    stack: ["Next.js", "Go"],
    url: "https://roaming.camp",
  };
  it("accepts a valid project and coerces dates", () => {
    const parsed = projectFrontmatterSchema.parse(ok);
    expect(parsed.start).toBeInstanceOf(Date);
    expect(parsed.end?.getFullYear()).toBe(2026);
  });
  it("rejects end before start", () => {
    const r = projectFrontmatterSchema.safeParse({ ...ok, end: "2024-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/end must not be before start/);
  });
  it("rejects done or live without end", () => {
    const { end: _end, ...noEnd } = ok;
    const r = projectFrontmatterSchema.safeParse({ ...noEnd, status: "live" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/status live requires end/);
  });
  it("accepts in-progress without end", () => {
    const { end: _end, ...noEnd } = ok;
    expect(projectFrontmatterSchema.safeParse({ ...noEnd, status: "in-progress" }).success).toBe(true);
  });
  it("rejects planned (projects cannot be planned)", () => {
    expect(projectFrontmatterSchema.safeParse({ ...ok, status: "planned" }).success).toBe(false);
  });
  it("requires a non-empty stack", () => {
    expect(projectFrontmatterSchema.safeParse({ ...ok, stack: [] }).success).toBe(false);
  });
});

describe("timelineEntrySchema", () => {
  const ok = {
    id: "dsd-talk-2026-03",
    title: "Talk: architecture patterns",
    description: "A talk.",
    start: "2026-03-01",
    status: "done",
  };
  it("accepts a moment", () => {
    expect(timelineEntrySchema.safeParse(ok).success).toBe(true);
  });
  it("rejects ids that are not kebab-case slugs", () => {
    expect(timelineEntrySchema.safeParse({ ...ok, id: "Not A Slug" }).success).toBe(false);
  });
  it("rejects planned without end", () => {
    const r = timelineEntrySchema.safeParse({ ...ok, status: "planned" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/planned requires end/);
  });
  it("rejects end before start", () => {
    expect(timelineEntrySchema.safeParse({ ...ok, end: "2025-01-01" }).success).toBe(false);
  });
});

describe("communityEntrySchema and learningEntrySchema", () => {
  it("community requires org", () => {
    const r = communityEntrySchema.safeParse({
      id: "x", title: "t", description: "d", start: "2026-01-01", status: "done",
    });
    expect(r.success).toBe(false);
  });
  it("learning requires roadmapHref and allows a testimonial", () => {
    const r = learningEntrySchema.safeParse({
      id: "100devs", title: "100Devs", description: "d", start: "2021-01-15", end: "2022-01-15",
      status: "done", roadmapHref: "/roadmap",
      testimonial: { quote: "q", author: "Leon Noel", role: "Managing Director of Engineering, Resilient Coders" },
    });
    expect(r.success).toBe(true);
  });
});
