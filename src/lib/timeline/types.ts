// src/lib/timeline/types.ts
// The one shape every clip on every page is built from (spec §5), plus the
// validation rules (spec §12). Pure: no Astro imports, so Vitest can load it.
import { z } from "zod";

export type Lane = "writing" | "building" | "learning" | "community";
export const LANES: readonly Lane[] = ["writing", "building", "learning", "community"];

export type Status = "done" | "live" | "in-progress" | "planned";
export type Kind = "moment" | "span";

export type InspectorBody =
  | { lane: "writing"; description: string; published: Date; href: string }
  | {
      lane: "building";
      description: string;
      stack: string[];
      started: Date;
      status: Status;
      url?: string;
      source?: string;
    }
  | { lane: "learning"; description: string; roadmapHref: string }
  | { lane: "community"; org: string; description: string; url?: string; linkLabel?: string };

export interface TimelineItem {
  id: string;
  lane: Lane;
  title: string;
  subtitle?: string;
  start: Date;
  end?: Date;
  status: Status;
  href: string;
  kind: Kind;
  /** Optional so the client script can rebuild items from the DOM without it. */
  body?: InspectorBody;
}

/** Spec §5: end, or in-progress without end, is a span; otherwise a moment. */
export function deriveKind(status: Status, end?: Date): Kind {
  if (end) return "span";
  if (status === "in-progress") return "span";
  return "moment";
}

export function assertUniqueIds(items: { id: string }[]): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`Duplicate timeline id: ${id}`);
    seen.add(id);
  }
}

export const statusSchema = z.enum(["done", "live", "in-progress", "planned"]);

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be a kebab-case slug");

function endNotBeforeStart(v: { start: Date; end?: Date }, ctx: z.RefinementCtx) {
  if (v.end && v.end.getTime() < v.start.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end must not be before start", path: ["end"] });
  }
}

function entryRules(v: { start: Date; end?: Date; status: Status }, ctx: z.RefinementCtx) {
  endNotBeforeStart(v, ctx);
  if (v.status === "planned" && !v.end) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "planned requires end", path: ["end"] });
  }
}

/** Frontmatter for src/content/projects/*.mdx (spec §6, §12). */
export const projectFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    status: z.enum(["done", "live", "in-progress"]),
    stack: z.array(z.string().min(1)).min(1),
    url: z.string().url().optional(),
    source: z.string().url().optional(),
  })
  .superRefine((v, ctx) => {
    endNotBeforeStart(v, ctx);
    if ((v.status === "done" || v.status === "live") && !v.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `status ${v.status} requires end`,
        path: ["end"],
      });
    }
  });
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

/** Shared shape for hand-authored entries in src/data/*.ts. */
export const timelineEntrySchema = z
  .object({
    id: slug,
    title: z.string().min(1),
    subtitle: z.string().optional(),
    description: z.string().min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    status: statusSchema,
    url: z.string().url().optional(),
  })
  .superRefine(entryRules);

export const communityEntrySchema = timelineEntrySchema.innerType()
  .extend({
    org: z.string().min(1),
    /** What the inspector's link says; "Details" when absent. */
    linkLabel: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    entryRules(v, ctx);
    if (v.linkLabel && !v.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "linkLabel requires url", path: ["linkLabel"] });
    }
  });
export type CommunityEntry = z.infer<typeof communityEntrySchema>;
