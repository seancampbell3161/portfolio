// Single source of truth for Open Graph screenshot pages.
// Consumed by: scripts/og-screenshots.mjs (plain Node), the Astro layout/pages
// (via Vite), and src/lib/__tests__/og.test.ts (Vitest).
// Kept as .mjs (not .ts) so the plain-node runner imports it without a compile step.

export const DEFAULT_BASE_URL = "https://seanthedeveloper.com";

// Each shot: `route` is the live path to screenshot; `name` is the asset basename.
export const OG_SHOTS = [
  { route: "/", name: "home" },
  { route: "/roadmap", name: "roadmap" },
  { route: "/blog", name: "blog" },
  { route: "/building", name: "building" },
];

// Public URL used in <meta og:image>; served from public/og/<name>.png.
export function ogImagePath(name) {
  return `/og/${name}.png`;
}

// Repo-relative filesystem path the runner writes each screenshot to.
export function outputFile(name) {
  return `public/og/${name}.png`;
}
