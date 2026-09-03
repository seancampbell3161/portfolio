// src/data/learning.ts
// Hand-authored Learning lane entries for sub-project 1 (spec §6). Sub-project 3
// replaces this file with derivation from src/data/roadmap.ts and live progress.
import { learningEntrySchema, type LearningEntry } from "../lib/timeline/types";

const raw = [
  {
    id: "100devs",
    title: "100Devs",
    subtitle: "where it started",
    description:
      "A free, community-run software engineering program led by Leon Noel. Where I learned to build for the web and to keep showing up.",
    start: "2021-01-15", // placeholder
    end: "2022-01-15", // placeholder
    status: "done",
    roadmapHref: "/roadmap",
    testimonial: {
      quote:
        "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
      author: "Leon Noel",
      role: "Managing Director of Engineering, Resilient Coders",
    },
  },
  {
    id: "ddia",
    title: "Designing Data-Intensive Applications",
    subtitle: "reading, one chapter at a time",
    description: "The anchor book on the roadmap's reading thread, read alongside the builds.",
    start: "2026-01-01", // placeholder
    status: "in-progress",
    roadmapHref: "/roadmap#rm-track-reading",
  },
  {
    id: "redis-build",
    title: "Build your own Redis",
    subtitle: "CodeCrafters",
    description:
      "One milestone per course, taken to pragmatic completion. Each checkpoint is a CodeCrafters stage group, and the milestone ends in a capstone decision log.",
    start: "2026-06-01", // placeholder
    status: "in-progress",
    roadmapHref: "/roadmap#rm-track-build",
  },
];

const learning: LearningEntry[] = raw.map((entry) => {
  const result = learningEntrySchema.safeParse(entry);
  if (!result.success) {
    throw new Error(`learning entry "${entry.id}": ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
});

export default learning;
