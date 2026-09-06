// The I/O multiplexing figure is server-rendered inside one essay, and
// src/scripts/figures/io-multiplexing.ts finds every part by data attribute.
// A markup change can break the figure with a green unit suite and a clean
// build, so this scans the built essays, finds the one that carries it (by
// hook, not by slug, so a rename cannot silently skip it), and asserts the
// hooks and the no-script state. It needs dist/, so it is skipped without
// one; `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "dist/blog";
const pages = existsSync(DIR)
  ? readdirSync(DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(DIR, d.name, "index.html"))
      .filter((p) => existsSync(p))
  : [];
const withFigure = pages.filter((p) => readFileSync(p, "utf8").includes("data-io-figure"));

describe.skipIf(pages.length === 0)("figure client contract (dist/blog/*)", () => {
  const html = withFigure[0] ? readFileSync(withFigure[0], "utf8") : "";

  it("exactly one essay carries the figure", () => {
    expect(withFigure).toHaveLength(1);
  });

  it("ships the still frame: epoll at 32, idle, not yet live", () => {
    expect(html).toMatch(/<figure class="iom[^"]*" data-io-figure data-mechanism="epoll" data-count="32" data-phase="idle"/);
    expect(html).not.toMatch(/<figure[^>]*data-live/);
  });

  it("ships the toolbar hidden, with every control", () => {
    expect(html).toMatch(/<div class="iom-bar[^"]*" data-io-controls hidden/);
    for (const hook of [
      'data-io-mechanism="select" aria-pressed="false"',
      'data-io-mechanism="epoll" aria-pressed="true"',
      'data-io-count="8" aria-pressed="false"',
      'data-io-count="32" aria-pressed="true"',
      'data-io-count="128" aria-pressed="false"',
      "data-io-step",
      'data-io-play aria-pressed="false"',
    ]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  // The inlined stylesheet names some attributes in its selectors, so the
  // cell counts match the elements, not the bare attribute.
  it("keeps the grid decorative, 16 columns, numbered, with 32 cells and three found", () => {
    expect(html).toMatch(/<div class="iom-grid[^"]*" data-io-grid aria-hidden="true" style="--cols:16;?" data-numbered/);
    expect(html.match(/<div class="iom-cell[^"]*" data-io-cell data-fd="\d+"/g)).toHaveLength(32);
    expect(html.match(/<div class="iom-cell[^"]*" data-io-cell data-fd="\d+" data-state="found"/g)).toHaveLength(3);
    // rebuildGrid renumbers clones through cell.querySelector("span"); every cell must open with one.
    expect(html.match(/<div class="iom-cell[^"]*" data-io-cell data-fd="\d+"[^>]*><span[^>]*>\d+<\/span>/g)).toHaveLength(32);
  });

  it("keeps the boxes the script writes into", () => {
    for (const hook of ["data-io-call-name", "data-io-call-status", "data-io-ready-title", "data-io-ready-note", "data-io-thread"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
    expect(html).toContain("returned 3 events");
    expect(html).toContain("ready: fd 4, 19, 27");
  });

  it("keeps the readout live and stating the thesis, and a dash in every tally row", () => {
    expect(html).toMatch(/data-io-readout aria-live="polite"/);
    expect(html).toContain("epoll_wait returned the 3 ready descriptors of 32 without checking the other 29. select or poll would have checked all 32.");
    for (const m of ["select", "poll", "epoll"]) {
      expect(html).toMatch(new RegExp(`data-io-tally="${m}"[^>]*>—<`));
    }
  });

  it("no longer references the old PNG", () => {
    expect(html).not.toContain("io_multiplexing_select_poll_epoll.png");
  });
});
