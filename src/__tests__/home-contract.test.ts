// The home page is server-rendered markup driven by src/scripts/timeline/, which
// finds its targets by data attribute and id. A markup change can break scrub,
// pan or the inspector with a green unit suite and a clean build, so this reads
// the built page and asserts every hook is still there. It needs dist/, so it is
// skipped without one; `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const PAGE = "dist/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("home client contract (dist/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  it("keeps the root, the overview strip's box and pin tick", () => {
    for (const hook of ["data-timeline", "data-ov-window", "data-ov-pin"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  it("keeps the ruler, ticks, playhead and cursor", () => {
    for (const hook of ["data-window-label", "data-ticks", "data-playhead", "data-cursor", "data-cursor-label"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  it("keeps the strip and the ruler aria-hidden in the built page; the script adds the roles", () => {
    expect(html).toMatch(/<div class="tl-ov" aria-hidden="true"/);
    expect(html).toMatch(/<div class="tl-ruler" aria-hidden="true"/);
    expect(html).not.toContain('role="slider"');
  });

  it("keeps the date panel and its two fill targets", () => {
    expect(html).toContain('id="on-date"');
    expect(html).toContain("data-on-date-title");
    expect(html).toContain("data-on-date-list");
  });

  it("keeps the zoom control and its three buttons", () => {
    expect(html).toContain("data-zoom-control");
    for (const z of ["year", "three-years", "all"]) {
      expect(html, `missing zoom ${z}`).toContain(`data-zoom="${z}"`);
    }
  });

  it("keeps every attribute, class and id the script rebuilds items and the graph from", () => {
    for (const hook of [
      'class="tl-item"', "data-id=", "data-lane=", "data-kind=", "data-status=", "data-start=",
      'class="tl-clip"', 'class="tl-title"', 'class="tl-sub"', 'class="tl-when"', 'id="item-',
      "data-item-link=", "data-inspector-close", "data-lane-summary=", "data-gutter", "data-nowline", "data-now-label",
    ]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  // The readout renders only when something touches the build day; the roadmap
  // threads keep that true into 2027. When this fails on an empty timeline, the
  // timeline itself is the news.
  it("keeps the hero readout the script prunes: block, rows, entries with ids, phrases", () => {
    const start = html.indexOf("data-right-now");
    expect(start, "missing data-right-now").toBeGreaterThan(-1);
    const block = html.slice(start, html.indexOf("</dl>", start));
    for (const hook of ['data-now-row="', "<dd data-id=", "data-now-when"]) {
      expect(block, `missing ${hook}`).toContain(hook);
    }
    const links = block.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a, `readout link without data-item-link: ${a}`).toContain("data-item-link=");
  });

  // A building clip's picture (thumbnails spec §5). Present as long as a project
  // with a picture is on the timeline; two are committed.
  it("keeps the clip thumbnail", () => {
    expect(html).toContain('class="tl-thumb"');
  });

  it("writes the building lane's row count on the root, which the layout pass keeps", () => {
    expect(html).toMatch(/<section class="tl"[^>]*--rows-building:\s*\d+/);
  });
});
