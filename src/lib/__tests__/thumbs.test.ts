import { describe, it, expect } from "vitest";
import { frontmatterOf, urlOf, projectShotTargets, thumbFile } from "../thumbs.mjs";

const roaming = `---
title: "Roaming.Camp"
start: 2025-03-01 # placeholder
status: live
url: "https://roaming.camp"
---

## Problem
`;
const rswebtwain = `---
title: "RSWebTWAIN"
status: done
source: "https://github.com/seancampbell3161/WebTWAIN"
---
`;

describe("frontmatterOf", () => {
  it("returns the text between the first two --- lines", () => {
    expect(frontmatterOf(roaming)).toContain('title: "Roaming.Camp"');
    expect(frontmatterOf(roaming)).not.toContain("## Problem");
  });
  it("accepts CRLF line endings", () => {
    expect(frontmatterOf("---\r\nurl: https://a.b\r\n---\r\nbody")).toBe("url: https://a.b");
  });
  it("is empty without a frontmatter block", () => {
    expect(frontmatterOf("# just a heading")).toBe("");
  });
});

describe("urlOf", () => {
  it("reads a quoted url", () => {
    expect(urlOf('url: "https://roaming.camp"')).toBe("https://roaming.camp");
  });
  it("reads a bare url and drops a trailing comment", () => {
    expect(urlOf("url: https://songle.lol # placeholder")).toBe("https://songle.lol");
  });
  it("ignores a commented-out url line", () => {
    expect(urlOf("# url: https://later.example\nstatus: done")).toBeUndefined();
  });
  it("is undefined when there is no url", () => {
    expect(urlOf("source: https://github.com/x/y")).toBeUndefined();
  });
});

describe("projectShotTargets", () => {
  it("pairs each file with a url to its slug, in order, and skips the rest", () => {
    const files = [
      { path: "src/content/projects/roaming-camp.mdx", source: roaming },
      { path: "src/content/projects/rswebtwain.mdx", source: rswebtwain },
    ];
    expect(projectShotTargets(files)).toEqual([{ slug: "roaming-camp", url: "https://roaming.camp" }]);
  });
  it("is empty when no file has a url", () => {
    expect(projectShotTargets([{ path: "a/b.mdx", source: rswebtwain }])).toEqual([]);
  });
});

describe("thumbFile", () => {
  it("builds the repo-relative jpg path from a slug", () => {
    expect(thumbFile("songle")).toBe("src/assets/projects/songle.jpg");
  });
});
