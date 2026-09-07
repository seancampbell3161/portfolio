// The router, the transition names and the prefetch opt-outs are invisible to
// the unit suite: they live in built HTML and in the bundled stylesheet. A
// markup or config change can drop any of them with a green suite and a clean
// build, so this reads dist/ and asserts each one. Needs dist/; skipped without
// one. `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Some projects (in-progress ones, mostly) have no committed screenshot, so
// their case study renders no hero. `requireHero` picks the first entry that
// does, so the shot-destination assertion below exercises a page that
// actually has one rather than whichever slug a directory listing surfaces
// first.
function firstPage(dir: string, requireHero = false): string | null {
  if (!existsSync(dir)) return null;
  const slugs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (requireHero) {
    const withHero = slugs.find((slug) => readFileSync(join(dir, slug, "index.html"), "utf8").includes('class="hero"'));
    if (withHero) return join(dir, withHero, "index.html");
  }
  return slugs[0] ? join(dir, slugs[0], "index.html") : null;
}

const PAGES: Record<string, string | null> = {
  home: "dist/index.html",
  writing: "dist/blog/index.html",
  building: "dist/building/index.html",
  roadmap: "dist/roadmap/index.html",
  essay: firstPage("dist/blog"),
  "case study": firstPage("dist/building", true),
};

const built = Object.values(PAGES).every((p) => p !== null && existsSync(p));
const read = (p: string) => readFileSync(p, "utf8");

/** Every stylesheet the build emitted, plus any inline <style> in the page. */
function styles(html: string): string {
  const dir = "dist/_astro";
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => read(join(dir, f)))
    : [];
  return [...files, ...(html.match(/<style[\s\S]*?<\/style>/g) ?? [])].join("\n");
}

describe.skipIf(!built)("view transitions contract (dist/)", () => {
  for (const [kind, path] of Object.entries(PAGES)) {
    const html = built ? read(path!) : "";

    it(`${kind}: enables the client router`, () => {
      expect(html).toContain('<meta name="astro-view-transitions-enabled" content="true">');
    });

    it(`${kind}: keeps the swap fallback rather than Astro's simulated animation`, () => {
      expect(html).toContain('<meta name="astro-view-transitions-fallback" content="swap">');
    });
  }

  it("keeps the transport bar out of the root cross-fade", () => {
    expect(styles(read("dist/index.html"))).toMatch(/\.tb\s*\{[^}]*view-transition-name:\s*bar/);
  });

  it("stands smooth scrolling down for the length of a navigation", () => {
    expect(styles(read("dist/index.html"))).toMatch(
      /html\[data-astro-transition\]\s*\{[^}]*scroll-behavior:\s*auto/,
    );
  });

  it("names both morph destinations", () => {
    const css = styles(read("dist/index.html"));
    expect(css).toMatch(/\[data-morph-dest=["']?shot["']?\]\s*\{[^}]*view-transition-name:\s*shot/);
    expect(css).toMatch(/\[data-morph-dest=["']?ptitle["']?\]\s*\{[^}]*view-transition-name:\s*ptitle/);
  });

  it("home: does not prefetch links whose clicks the inspector intercepts", () => {
    const html = read("dist/index.html");
    const links = html.match(/<a[^>]*data-item-link[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a).toContain('data-astro-prefetch="false"');
  });

  it("home: every inspector panel offers a morph source", () => {
    const html = read("dist/index.html");
    const panels = html.match(/<section class="insp"[^>]*>/g) ?? [];
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) expect(p).toContain("data-morph");
    expect(html).toContain("data-morph-title");
    expect(html).toContain("data-morph-shot");
  });

  it("building index: rows offer a title to morph", () => {
    const html = read("dist/building/index.html");
    expect(html).toContain("data-morph");
    expect(html).toContain("data-morph-title");
  });

  it("case study: names both destinations", () => {
    const html = read(PAGES["case study"]!);
    expect(html).toContain('data-morph-dest="ptitle"');
    expect(html).toContain('data-morph-dest="shot"');
  });

  it("essay: names its heading as a destination", () => {
    expect(read(PAGES.essay!)).toContain('data-morph-dest="ptitle"');
  });
});
