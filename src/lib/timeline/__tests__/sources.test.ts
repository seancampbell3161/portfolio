import { describe, it, expect } from "vitest";
import { fromBlog, fromProjects, fromCommunity, fromRoadmap, mergeTimeline } from "../sources.js";
import type { BlogLike, ProjectLike } from "../sources.js";

const d = (s: string) => new Date(s);

const posts: BlogLike[] = [
  { slug: "i-wont-stop-coding", data: { title: "I Won't Stop Coding", description: "Why", pubDate: d("2026-09-01"), tags: ["Coding", "AI"], draft: false } },
  { slug: "open-source-projects", data: { title: "3 Open Source Projects", description: "d", pubDate: d("2026-06-13"), tags: [], draft: true } },
];

const projects: ProjectLike[] = [
  { slug: "roaming-camp", data: { title: "Roaming.Camp", description: "Campsites", start: d("2025-03-01"), end: d("2026-06-30"), status: "live", stack: ["Next.js", "Go"], url: "https://roaming.camp" } },
  { slug: "daw-engine", data: { title: "Browser DAW engine", description: "Audio", start: d("2026-06-01"), status: "in-progress", stack: ["Rust", "WASM"] } },
];

describe("fromBlog", () => {
  it("excludes drafts unless asked to include them", () => {
    expect(fromBlog(posts, { includeDrafts: false }).map((i) => i.id)).toEqual(["essay-i-wont-stop-coding"]);
    expect(fromBlog(posts, { includeDrafts: true })).toHaveLength(2);
  });
  it("makes moments on the writing lane linking to the post", () => {
    const [item] = fromBlog(posts, { includeDrafts: false });
    expect(item.lane).toBe("writing");
    expect(item.kind).toBe("moment");
    expect(item.status).toBe("done");
    expect(item.start).toEqual(d("2026-09-01"));
    expect(item.href).toBe("/blog/i-wont-stop-coding");
    expect(item.subtitle).toBe("Coding, AI");
    expect(item.body).toEqual({ lane: "writing", description: "Why", published: d("2026-09-01"), href: "/blog/i-wont-stop-coding" });
  });
  it("omits the subtitle when there are no tags", () => {
    const [, draft] = fromBlog(posts, { includeDrafts: true });
    expect(draft.subtitle).toBeUndefined();
  });
});

describe("fromProjects", () => {
  it("makes spans on the building lane with the stack as subtitle", () => {
    const [roaming, daw] = fromProjects(projects);
    expect(roaming.id).toBe("roaming-camp");
    expect(roaming.lane).toBe("building");
    expect(roaming.kind).toBe("span");
    expect(roaming.end).toEqual(d("2026-06-30"));
    expect(roaming.subtitle).toBe("Next.js, Go");
    expect(roaming.href).toBe("/building/roaming-camp");
    expect(daw.kind).toBe("span");
    expect(daw.end).toBeUndefined();
  });
  it("carries facts into the body", () => {
    const [roaming] = fromProjects(projects);
    expect(roaming.body).toEqual({
      lane: "building", description: "Campsites", stack: ["Next.js", "Go"], started: d("2025-03-01"),
      status: "live", url: "https://roaming.camp", source: undefined,
    });
  });
});

describe("fromCommunity", () => {
  it("community uses org as the subtitle when none is given", () => {
    const [talk] = fromCommunity([
      { id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers", start: d("2026-03-01"), status: "done" },
    ]);
    expect(talk.lane).toBe("community");
    expect(talk.subtitle).toBe("Dallas Software Developers");
    expect(talk.kind).toBe("moment");
    expect(talk.href).toBe("/#item-dsd-talk");
    expect(talk.body).toEqual({
      lane: "community", org: "Dallas Software Developers", description: "d", url: undefined, linkLabel: undefined,
    });
  });
  it("carries a link label into the body", () => {
    const [talk] = fromCommunity([
      {
        id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers",
        start: d("2026-03-01"), status: "done", url: "https://example.com/talk", linkLabel: "Watch the talk",
      },
    ]);
    expect(talk.body).toMatchObject({ url: "https://example.com/talk", linkLabel: "Watch the talk" });
  });
});

describe("fromRoadmap", () => {
  const now = new Date("2026-09-02T00:00:00Z");
  it("produces the three learning-lane thread spans", () => {
    const items = fromRoadmap(now);
    expect(items.map((i) => i.id)).toEqual(["roadmap-build", "roadmap-reading", "roadmap-foundations"]);
    expect(items.every((i) => i.lane === "learning")).toBe(true);
  });
});

describe("mergeTimeline", () => {
  it("sorts by start then id across sources", () => {
    const merged = mergeTimeline(fromBlog(posts, { includeDrafts: false }), fromProjects(projects));
    expect(merged.map((i) => i.id)).toEqual(["roaming-camp", "daw-engine", "essay-i-wont-stop-coding"]);
  });
  it("rejects duplicate ids", () => {
    expect(() => mergeTimeline(fromProjects(projects), fromProjects(projects))).toThrow("Duplicate timeline id: roaming-camp");
  });
});
