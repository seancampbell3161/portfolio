// src/lib/thumbs.mjs
// Which projects get a screenshot and where it goes (thumbnails spec §4.1).
// Plain .mjs, like og.mjs, so scripts/project-screenshots.mjs runs it without
// a compile step and Vitest tests it.

/** The frontmatter block of an MDX file: the text between its first two `---` lines, or "" without one. */
export function frontmatterOf(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return m ? m[1] : "";
}

/** The `url:` value of a frontmatter block, unquoted, without a trailing `#` comment; undefined when absent. */
export function urlOf(frontmatter) {
  const m = /^url:\s*("?)([^"\s#]+)\1/m.exec(frontmatter);
  return m ? m[2] : undefined;
}

/**
 * `{ slug, url }` for every project file that has a url, in the order given.
 * Each file is `{ path, source }`; the slug is the basename without `.mdx`.
 * A project without a url is not a target, so a picture placed by hand under
 * its slug is never overwritten.
 */
export function projectShotTargets(files) {
  return files.flatMap(({ path, source }) => {
    const url = urlOf(frontmatterOf(source));
    if (!url) return [];
    const slug = path.replace(/^.*\//, "").replace(/\.mdx$/, "");
    return [{ slug, url }];
  });
}

/** Repo-relative path the runner writes a project's screenshot to. */
export function thumbFile(slug) {
  return `src/assets/projects/${slug}.jpg`;
}
