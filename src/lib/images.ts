// src/lib/images.ts
// The slug-to-picture map over src/assets/projects/ (thumbnails spec §4.2).
// Vite-only, the way src/lib/timeline/astro.ts is Astro-only: import.meta.glob
// is resolved at build, so nothing else in src/lib/ has to know about assets.
import type { ImageMetadata } from "astro";

const files = import.meta.glob<{ default: ImageMetadata }>("/src/assets/projects/*.{jpg,png}", { eager: true });

const bySlug = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) {
  const slug = path.replace(/^.*\//, "").replace(/\.(jpg|png)$/, "");
  // Two pictures for one project would mean one silently wins; fail the build instead.
  if (bySlug.has(slug)) throw new Error(`Two pictures for project "${slug}" in src/assets/projects/`);
  bySlug.set(slug, mod.default);
}

/** The project's screenshot, or undefined when none is committed under its slug. */
export function projectImage(slug: string): ImageMetadata | undefined {
  return bySlug.get(slug);
}
