// src/lib/timeline/astro.ts
// The only timeline module that imports from Astro. Everything it calls is pure.
import { getCollection, type CollectionEntry } from "astro:content";
import community from "../../data/community";
import learning from "../../data/learning";
import { fromBlog, fromCommunity, fromLearning, fromProjects, mergeTimeline } from "./sources";
import type { TimelineItem } from "./types";

export interface TimelineData {
  items: TimelineItem[];
  /** Build time. The client script nudges the playhead to the real date. */
  now: Date;
  projects: CollectionEntry<"projects">[];
}

export async function getTimeline(): Promise<TimelineData> {
  const includeDrafts = !import.meta.env.PROD;
  const blog = await getCollection("blog", ({ data }) => includeDrafts || !data.draft);
  const projects = await getCollection("projects");
  const items = mergeTimeline(
    fromBlog(blog, { includeDrafts }),
    fromProjects(projects),
    fromCommunity(community),
    fromLearning(learning),
  );
  return { items, now: new Date(), projects };
}
