// src/data/community.ts
// Hand-authored Community lane entries (spec §6). Validated at module load so
// a bad entry fails the build with its id in the message. `url` plus `linkLabel`
// give the inspector a labelled link ("Watch the talk"); both are optional, and
// a label without a url is rejected. Dates marked placeholder are still to be
// confirmed by the owner (everything-else spec §14).
import { communityEntrySchema, type CommunityEntry } from "../lib/timeline/types";

const raw = [
  {
    id: "dsd-cohort-lead",
    title: "Engineer team lead, DSD cohort",
    org: "Dallas Software Developers",
    description:
      "Mentored aspiring developers through their learning journey, conducting code reviews and pair programming sessions.",
    start: "2023-03-01", // placeholder
    end: "2024-02-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-architecture",
    title: "Talk: architecture patterns",
    org: "Dallas Software Developers",
    description: "Backend and frontend architecture patterns, for the Dallas Software Developers meetup.",
    start: "2025-04-01", // placeholder: confirm the talk and its month
    status: "done",
    // url: "https://example.com/talk-recording", linkLabel: "Watch the talk",
  },
  {
    id: "dsd-talk-productivity",
    title: "Talk: developer productivity",
    org: "Dallas Software Developers",
    description: "Developer productivity, for the Dallas Software Developers meetup.",
    start: "2026-03-01", // placeholder: confirm the talk and its month
    status: "done",
    // url: "https://example.com/talk-recording", linkLabel: "Watch the talk",
  },
  {
    id: "commit-your-code-2026",
    title: "Commit Your Code 2026",
    org: "Dallas Software Developers",
    description:
      "Two days in Plano, learning modern AI concepts from the talks, sharing technical discussions with other engineers who are just as passionate about the work, and showing up for my local developer community.",
    // A moment, not a span: rangeText collapses a same-month start/end to just
    // "September 2026", while a moment reads as "03 September 2026". The second
    // day lives in the description above.
    start: "2026-09-03",
    status: "done",
    url: "https://www.commityourcode.com/",
    linkLabel: "Conference site",
  },
];

const community: CommunityEntry[] = raw.map((entry) => {
  const result = communityEntrySchema.safeParse(entry);
  if (!result.success) {
    throw new Error(`community entry "${entry.id}": ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
});

export default community;
