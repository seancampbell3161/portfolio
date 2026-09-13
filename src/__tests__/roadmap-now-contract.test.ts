// /roadmap/now is server-rendered markup driven by three client scripts:
// src/scripts/roadmap.ts (checkpoints, logs, edit mode), src/scripts/review.ts
// (the review deck) and src/scripts/roadmap-schedule.ts (which phase and build
// show). They find their targets by id and data attribute, so a markup change
// can break saved progress, or show one phase's heading over another phase's
// work, with a green unit suite and a clean build. This reads the built page.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first. roadmap-contract.test.ts fails whenever /roadmap is built and this
// page is not, so this suite cannot skip itself silently.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build, phases, logIds } from "../data/roadmap";
import { phaseSpanText } from "../lib/roadmap/schedule";
import { weekStart } from "../lib/roadmap/weeks";
import { isoDay } from "../lib/dates";

const PAGE = "dist/roadmap/now/index.html";
const built = existsSync(PAGE);

type Block = { tag: string; value: string; index: number; hidden: boolean };

/** Every opening tag carrying `attr`, with the attribute's value and whether the tag is hidden. */
function blocks(html: string, attr: string): Block[] {
  const re = new RegExp(`<[a-z][a-z0-9]*\\b[^>]*\\s${attr}="([^"]+)"[^>]*>`, "g");
  return [...html.matchAll(re)].map((m) => ({
    tag: m[0],
    value: m[1],
    index: m.index!,
    hidden: /\shidden[\s>]/.test(m[0]),
  }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe.skipIf(!built)("roadmap/now client contract (dist/roadmap/now/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  const headers = blocks(html, "data-phase-start").map((h) => ({
    ...h,
    phase: h.tag.match(/\sdata-now-phase="([^"]+)"/)?.[1] ?? "",
  }));
  const pairings = blocks(html, "data-now-phase").filter((b) => !b.tag.includes("data-phase-start"));
  const builds = blocks(html, "data-now-milestone");
  const shownHeaders = headers.filter((h) => !h.hidden);
  const label = html.match(/data-week-label[^>]*>([^<]*)</)?.[1] ?? "";

  // roadmap.ts: the edit controls and the live region. The meters stay on /roadmap.
  const TOOLBAR_IDS = ["rm-edit", "rm-message", "rm-save-state", "rm-clip-live"];
  // review.ts: the runner, the card faces, the counters and the message line.
  const REVIEW_IDS = [
    "rv-runner", "rv-runner-done", "rv-runner-locked", "rv-card", "rv-front", "rv-back",
    "rv-reveal", "rv-ratings", "rv-message", "rv-save-state", "rv-thread",
    "rv-due-count", "rv-streak", "rv-rotation-count", "rv-rotation-summary", "rv-rotation-empty",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toMatch(/class="roadmap-page"/);
  });

  it("keeps the toolbar's and the review deck's fixed ids", () => {
    for (const id of [...TOOLBAR_IDS, ...REVIEW_IDS]) {
      expect(html, `missing id ${id}`).toContain(`id="${id}"`);
    }
  });

  it("keeps the review deck's rating buttons and per-thread counters", () => {
    for (const rating of [0, 1, 2, 3]) {
      expect(html, `missing rating ${rating}`).toContain(`data-rv-rate="${rating}"`);
    }
    for (const thread of ["build", "reading", "foundations", "judgment", "behavioral"]) {
      expect(html, `missing thread count ${thread}`).toContain(`data-rv-thread-count="${thread}"`);
    }
  });

  it("renders the week label with real text before any script runs", () => {
    expect(label).toMatch(/Week \d+ of \d+|Ramp week|The plan (starts|is finished)/);
  });

  it("server-renders a header and a pairings block for every phase, and a build block for every milestone", () => {
    expect(headers.map((h) => h.phase)).toEqual(phases.map((p) => p.id));
    expect(pairings.map((b) => b.value)).toEqual(phases.map((p) => p.id));
    expect(builds.map((b) => b.value)).toEqual(build.map((m) => m.id));
  });

  it("stamps each header with its first Monday and its milestone, for the stale-visit e2e", () => {
    for (const p of phases) {
      const h = headers.find((x) => x.phase === p.id)!;
      expect(h.tag, `${p.id} start`).toContain(`data-phase-start="${isoDay(weekStart(p.fromWeek))}"`);
      if (p.milestone) expect(h.tag, `${p.id} milestone`).toContain(`data-phase-milestone="${p.milestone}"`);
      else expect(h.tag, `${p.id} has no milestone`).not.toContain("data-phase-milestone");
    }
  });

  it("reveals at most one phase, with its own pairings and its own milestone's build", () => {
    expect(shownHeaders.length, "more than one phase header is visible").toBeLessThanOrEqual(1);
    const shownPairings = pairings.filter((b) => !b.hidden).map((b) => b.value);
    const shownBuilds = builds.filter((b) => !b.hidden).map((b) => b.value);
    if (shownHeaders.length === 0) {
      expect(shownPairings).toEqual([]);
      expect(shownBuilds).toEqual([]);
      return;
    }
    const phase = phases.find((p) => p.id === shownHeaders[0].phase)!;
    expect(shownPairings).toEqual([phase.id]);
    expect(shownBuilds).toEqual(phase.milestone ? [phase.milestone] : []);
  });

  it("shows a phase whenever the label names a week", () => {
    if (/Week \d+ of \d+|Ramp week/.test(label)) {
      expect(shownHeaders, `label reads "${label}" but no phase is visible`).toHaveLength(1);
    }
  });

  it("shows the outside-the-plan line exactly when no phase is showing", () => {
    const outside = html.match(/<[a-z]+\b[^>]*\sdata-now-outside\b[^>]*>/)?.[0];
    expect(outside, "missing data-now-outside").toBeDefined();
    expect(/\shidden[\s>]/.test(outside!)).toBe(shownHeaders.length === 1);
  });

  it("renders every build checkbox and every decision log exactly once", () => {
    // M5 and the Capstone share Kafka. A build block per phase would print its
    // inputs twice, so they live in one block per milestone (roadmap-now spec §6).
    const countOf = (re: RegExp) => (html.match(re) ?? []).length;
    const checkbox = (id: string) =>
      new RegExp(`<input\\b(?=[^>]*\\bdata-id="${escapeRe(id)}")(?=[^>]*\\btype="checkbox")[^>]*>`, "g");
    for (const id of [...build.flatMap((m) => m.groups.map((g) => g.id)), ...logIds]) {
      expect(countOf(checkbox(id)), `checkbox ${id}`).toBe(1);
    }
    for (const id of logIds) {
      expect(countOf(new RegExp(`<details\\b[^>]*\\bdata-log-id="${escapeRe(id)}"`, "g")), `log ${id}`).toBe(1);
    }
  });

  it("ships roadmap.ts in exactly one script file, inlined into neither roadmap page", () => {
    // Both roadmap pages run src/scripts/roadmap.ts, whose module state (the
    // completed set, the save timer, pendingFlush) only works as ONE instance:
    // two copies would each register onPage(initRoadmap), and one toggle would
    // save twice (roadmap-now spec §9). Rollup puts a module that two page
    // entries import into a shared chunk; this pins that in `npm run check`,
    // where the e2e does not run. The needle is a string only roadmap.ts
    // contains, and string literals survive minification.
    const needle = "your last change was undone";
    const dir = "dist/_astro";
    const holders = readdirSync(dir).filter(
      (f) => f.endsWith(".js") && readFileSync(join(dir, f), "utf8").includes(needle),
    );
    expect(holders, "roadmap.ts must live in exactly one script file").toHaveLength(1);
    for (const page of ["dist/roadmap/index.html", PAGE]) {
      expect(readFileSync(page, "utf8"), `${page} inlines roadmap.ts`).not.toContain(needle);
    }
  });

  it("never repeats an element id", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("says which weeks the visible phase covers", () => {
    // The label counts one week; the phase covers several. The header has to say
    // so, or seven weeks of work reads as one week's.
    const h = shownHeaders[0];
    if (!h) return; // outside the plan there is no phase to scope
    const phase = phases.find((p) => p.id === h.phase)!;
    const markup = html.slice(h.index, html.indexOf("</header>", h.index));
    expect(markup).toContain(phaseSpanText(phase));
    expect(markup).toContain(phase.label);
  });

  /** One phase's pairings block, up to the next pairings block or the outside line. */
  const pairingsOf = (id: string): string => {
    const i = pairings.findIndex((b) => b.value === id);
    const next = pairings[i + 1]?.index ?? html.indexOf("data-now-outside", pairings[i].index);
    return html.slice(pairings[i].index, next);
  };

  it("prints each book's title once, however many of its chapters a phase carries", () => {
    // M1 reads seven OSTEP chapters. Flat, that repeated the book's title seven times.
    const m1 = pairingsOf("m1");
    const book = "Operating Systems: Three Easy Pieces";
    expect(m1.split(book)).toHaveLength(2); // one occurrence
    expect(m1).toContain("P1. Persistence"); // still every chapter
    expect(m1).toContain("C3. Concurrency");
  });

  it("derives a foundation item's workload rather than repeating it in a note", () => {
    const m1 = pairingsOf("m1");
    expect(m1).toContain("7 problems"); // fd.nc.stack's own `total`
    expect(m1).not.toMatch(/<small[^>]*>\s*7\s*<\/small>/); // never the bare number
  });
});
