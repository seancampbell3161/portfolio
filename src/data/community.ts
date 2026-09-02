// src/data/community.ts
// Hand-authored Community lane entries (spec §6). Validated at module load so
// a bad entry fails the build with its id in the message.
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
    id: "dsd-talk-2024",
    title: "Talk: architecture patterns",
    org: "Dallas Software Developers",
    description: "Backend and frontend architecture patterns, for the Dallas Software Developers meetup.",
    start: "2024-06-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2025",
    title: "Talk: developer productivity",
    org: "Dallas Software Developers",
    description: "Developer productivity, for the Dallas Software Developers meetup.",
    start: "2025-04-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2026-03",
    title: "Talk: architecture patterns",
    org: "Dallas Software Developers",
    description: "Architecture patterns, for the Dallas Software Developers meetup.",
    start: "2026-03-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2026-08",
    title: "Talk: developer productivity",
    org: "Dallas Software Developers",
    description: "Developer productivity, for the Dallas Software Developers meetup.",
    start: "2026-08-01", // placeholder
    status: "done",
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
