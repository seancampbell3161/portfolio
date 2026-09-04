// src/data/testimonial.ts
// The one testimonial on the site, shown in the contact block (everything-else
// spec §6.1). It came out of 100Devs, which is no longer on the timeline; the
// quote stands on its own at the hiring moment.
export const testimonial = {
  quote:
    "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
  author: "Leon Noel",
  role: "Managing Director of Engineering, Resilient Coders",
} as const;
