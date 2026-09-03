import { defineCollection, z } from 'astro:content';
import { projectFrontmatterSchema } from '../lib/timeline/types';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// Case studies. Frontmatter rules live in src/lib/timeline/types.ts so the
// same schema validates in Vitest (spec §12).
const projects = defineCollection({
  type: 'content',
  schema: projectFrontmatterSchema,
});

export const collections = { blog, projects };
