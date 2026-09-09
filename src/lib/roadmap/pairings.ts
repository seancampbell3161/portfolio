// src/lib/roadmap/pairings.ts
// Turns a phase's flat Pairing[] into the rows a list renders. Pure — no Astro,
// no DOM — so Vitest holds every wording rule the band and the inspector print.
//
// Why this exists: PairingList used to build one lossy string per pairing
// ("Book — 3. Chapter"), which repeated a book's title on every one of its
// chapters and threw away the grouping the data still has. It also let a
// pairing's `note` carry facts the item already owns — a bare "5" beside an
// item whose `total` is 5, a "Redis hash store" beside one whose `pairsWith`
// says exactly that. Both are derived here instead, so they cannot drift.
import { reading, foundations, type Pairing } from "../../data/roadmap.js";

export interface PairingRow {
  /** What the reader sees: a numbered chapter, or a foundation item's label. */
  label: string;
  /** The schedule's reason for this pairing, or the item's own pairsWith. */
  note: string;
  /** Derived workload — "7 problems", "40 lessons". Chapters have none. */
  count?: string;
  optional: boolean;
}

export interface PairingGroup {
  /** The book or foundation group this run of rows belongs to. */
  title: string;
  rows: PairingRow[];
}

interface Resolved {
  label: string;
  count?: string;
  fallbackNote?: string;
}

/** ref → its group title and the parts of its row that come from the data. */
const index = new Map<string, { group: string; resolved: Resolved }>();
for (const b of reading) {
  for (const c of b.chapters) {
    index.set(c.id, { group: b.title, resolved: { label: `${c.no}. ${c.title}` } });
  }
}
for (const g of foundations) {
  for (const i of g.items) {
    index.set(i.id, {
      group: g.label,
      resolved: {
        label: i.label,
        count:
          i.total === undefined
            ? undefined
            : `${i.total} ${i.kind === "course" ? "lessons" : "problems"}`,
        fallbackNote: i.pairsWith,
      },
    });
  }
}

/**
 * One pairing as its group title plus its row. An unresolvable ref renders as
 * the ref itself: a data error should be visible on the page, not swallowed.
 */
export function resolvePairing(p: Pairing): { group: string; row: PairingRow } {
  const hit = index.get(p.ref);
  const resolved = hit?.resolved ?? { label: p.ref };
  return {
    group: hit?.group ?? "",
    row: {
      label: resolved.label,
      note: p.note || resolved.fallbackNote || "",
      count: resolved.count,
      optional: p.optional ?? false,
    },
  };
}

/**
 * The pairings as groups, so a book's title is printed once rather than once
 * per chapter. Groups appear in the order they first appear, and a book the
 * schedule returns to later merges back into its first group: the band is a
 * phase overview, not a running order, and one entry per book reads more like
 * a shelf than a repeated heading does. Each row keeps its own note, which is
 * where the schedule's sequencing ("alongside RDB/AOF") actually lives.
 */
export function groupPairings(items: readonly Pairing[]): PairingGroup[] {
  const groups = new Map<string, PairingGroup>();
  for (const p of items) {
    const { group, row } = resolvePairing(p);
    let g = groups.get(group);
    if (!g) groups.set(group, (g = { title: group, rows: [] }));
    g.rows.push(row);
  }
  return [...groups.values()];
}
