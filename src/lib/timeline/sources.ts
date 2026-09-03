// Adapters from each content source to TimelineItem (spec §6). Pure: they take
// plain arrays so Vitest can test them; src/lib/timeline/astro.ts feeds them.
// fromRoadmap is the exception: it takes no array, deriving its Learning-lane
// spans straight from the roadmap module (covered by
// src/lib/roadmap/__tests__/arrange.test.ts).
import type { CommunityEntry, ProjectFrontmatter, TimelineItem } from "./types.js";
import { assertUniqueIds, deriveKind } from "./types.js";
import { threadSpans } from "../roadmap/arrange.js";

/** The part of CollectionEntry<'blog'> this adapter reads. */
export interface BlogLike {
  slug: string;
  data: { title: string; description: string; pubDate: Date; tags: string[]; draft: boolean };
}

/** The part of CollectionEntry<'projects'> this adapter reads. */
export interface ProjectLike {
  slug: string;
  data: ProjectFrontmatter;
}

export function fromBlog(entries: readonly BlogLike[], opts: { includeDrafts: boolean }): TimelineItem[] {
  return entries
    .filter((e) => opts.includeDrafts || !e.data.draft)
    .map((e) => {
      const href = `/blog/${e.slug}`;
      return {
        id: `essay-${e.slug}`,
        lane: "writing",
        title: e.data.title,
        subtitle: e.data.tags.length ? e.data.tags.join(", ") : undefined,
        start: e.data.pubDate,
        status: "done",
        href,
        kind: "moment",
        body: { lane: "writing", description: e.data.description, published: e.data.pubDate, href },
      };
    });
}

export function fromProjects(entries: readonly ProjectLike[]): TimelineItem[] {
  return entries.map((e) => {
    const p = e.data;
    return {
      id: e.slug,
      lane: "building",
      title: p.title,
      subtitle: p.stack.join(", "),
      start: p.start,
      end: p.end,
      status: p.status,
      href: `/#item-${e.slug}`,
      kind: deriveKind(p.status, p.end),
      body: {
        lane: "building",
        description: p.description,
        stack: p.stack,
        started: p.start,
        status: p.status,
        url: p.url,
        source: p.source,
      },
    };
  });
}

export function fromCommunity(entries: readonly CommunityEntry[]): TimelineItem[] {
  return entries.map((e) => ({
    id: e.id,
    lane: "community",
    title: e.title,
    subtitle: e.subtitle ?? e.org,
    start: e.start,
    end: e.end,
    status: e.status,
    href: `/#item-${e.id}`,
    kind: deriveKind(e.status, e.end),
    body: { lane: "community", org: e.org, description: e.description, url: e.url },
  }));
}

/** Spec §10: the home Learning lane is derived from the roadmap. */
export function fromRoadmap(now: Date): TimelineItem[] {
  return threadSpans(now);
}

/** One chronological list. Throws on duplicate ids (spec §12). */
export function mergeTimeline(...groups: readonly (readonly TimelineItem[])[]): TimelineItem[] {
  const all = groups.flat();
  assertUniqueIds(all);
  return all.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
}
