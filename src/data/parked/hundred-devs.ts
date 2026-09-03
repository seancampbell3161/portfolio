// Parked: 100Devs and Leon Noel's testimonial. Removed from the timeline in
// sub-project 3 (docs/superpowers/specs/2026-09-02-arrangement-roadmap-design.md
// §10) because the Learning lane now derives from the roadmap. Kept verbatim
// until we decide where, if anywhere, it belongs. Not imported anywhere.
export const hundredDevs = {
  id: "100devs",
  title: "100Devs",
  subtitle: "where it started",
  description:
    "A free, community-run software engineering program led by Leon Noel. Where I learned to build for the web and to keep showing up.",
  start: "2021-01-15",
  end: "2022-01-15",
  status: "done",
  testimonial: {
    quote:
      "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
    author: "Leon Noel",
    role: "Managing Director of Engineering, Resilient Coders",
  },
} as const;
