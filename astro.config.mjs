import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://seanthedeveloper.com',
  // <ClientRouter /> silently enables prefetching at prefetchAll: true. Written
  // down rather than inherited (spec §8). Links whose clicks JavaScript
  // reinterprets opt out with data-astro-prefetch="false".
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
