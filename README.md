# Sean Campbell Portfolio

A modern, fast, and content-driven portfolio site built with [Astro](https://astro.build).

## Features

- ⚡ **Lightning fast** - Ships zero JS by default
- 📝 **Blog ready** - MDX support with content collections  
- 🎨 **Sleek design** - Dark theme with subtle animations
- 📱 **Fully responsive** - Mobile-first approach
- 🔍 **SEO optimized** - Meta tags, sitemap, and semantic HTML
- 🚀 **Deploy anywhere** - Configured for Netlify
- 🎯 **Lucide icons** - Clean, consistent iconography (zero dependencies)

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
/
├── public/
│   ├── favicon.svg
│   └── images/
│       ├── profile.jpg          # Your profile photo
│       ├── README.md            # Image requirements guide
│       └── beyond/
│           ├── speaking.jpg     # Conference/meetup photo
│           ├── mentoring.jpg    # Teaching/collaboration photo
│           └── opensource.jpg   # Open source contribution image
├── src/
│   ├── components/
│   │   ├── Beyond.astro         # Community involvement (with images)
│   │   ├── Contact.astro        # Contact CTA
│   │   ├── Currently.astro      # What I'm building (with icons)
│   │   ├── Footer.astro         # Footer with social icons
│   │   ├── Hero.astro           # Hero with profile photo
│   │   ├── Icon.astro           # Lucide icon component
│   │   ├── Nav.astro            # Navigation with social icons
│   │   ├── Projects.astro       # Case study cards (with icons)
│   │   └── Testimonial.astro
│   ├── content/
│   │   └── blog/                # Blog posts (MDX)
│   ├── layouts/
│   │   ├── BlogPost.astro
│   │   └── Layout.astro
│   ├── pages/
│   │   ├── blog/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   ├── 404.astro
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── netlify.toml
├── package.json
└── tsconfig.json
```

## Adding Your Images

Before deploying, add your images to the `/public/images/` folder:

### Required Images

| Image | Location | Size | Description |
|-------|----------|------|-------------|
| Profile | `/public/images/profile.jpg` | 640x760px | Your headshot/photo |
| Speaking | `/public/images/beyond/speaking.jpg` | 800x500px | Conference/meetup photo |
| Mentoring | `/public/images/beyond/mentoring.jpg` | 800x500px | Teaching/collaboration |
| Open Source | `/public/images/beyond/opensource.jpg` | 800x500px | Contributions visual |

See `/public/images/README.md` for detailed guidance on image selection.

## Customization

### Personal Information

Edit the component files in `src/components/` to update:

- **Hero.astro** - Name, title, tagline, tech stack, stats, profile image
- **Beyond.astro** - Speaking, teaching, open source (with images)
- **Projects.astro** - Case studies with problem/solution/tradeoffs/impact
- **Testimonial.astro** - Quote, author name, title
- **Currently.astro** - What you're learning/building
- **Contact.astro** - Email address, headline
- **Nav.astro** - Social links (GitHub, LinkedIn, Twitter)
- **Footer.astro** - Social links

### Site Config

Update `astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://yourdomain.com', // Your domain
  // ...
});
```

### Social Links

Update social links in both `Nav.astro` and `Footer.astro`:

```javascript
const socialLinks = [
  { href: 'https://github.com/yourusername', icon: 'github', label: 'GitHub' },
  { href: 'https://linkedin.com/in/yourusername', icon: 'linkedin', label: 'LinkedIn' },
  { href: 'https://twitter.com/yourusername', icon: 'twitter', label: 'Twitter' },
];
```

### Colors & Typography

Edit CSS variables in `src/styles/global.css`:

```css
:root {
  --color-accent: #60a5fa;           /* Primary accent (blue) */
  --color-accent-secondary: #a78bfa;  /* Secondary accent (purple) */
  /* ... */
}
```

### Adding Icons

The `Icon.astro` component includes common Lucide icons. To add more:

1. Find the icon on [lucide.dev](https://lucide.dev)
2. Copy the SVG path data
3. Add to the `icons` object in `src/components/Icon.astro`

## Adding Blog Posts

Create new `.mdx` files in `src/content/blog/`:

```mdx
---
title: "Your Post Title"
description: "A brief description"
pubDate: 2024-12-15
tags: ["Tag1", "Tag2"]
heroImage: "/images/blog/post-hero.jpg"  # Optional
draft: false  # Set to true to hide
---

Your content here with full MDX support.
```

## Deployment to Netlify

### Option 1: Git Integration (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Log in to [Netlify](https://app.netlify.com)
3. Click "New site from Git"
4. Select your repository
5. Build settings are auto-detected from `netlify.toml`
6. Click "Deploy site"

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy (creates new site)
netlify deploy --prod
```

### Option 3: Drag & Drop

```bash
npm run build
```

Then drag the `dist/` folder to [Netlify Drop](https://app.netlify.com/drop).

## Custom Domain

1. In Netlify dashboard, go to Site settings → Domain management
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## Performance Tips

- **Images**: Use `.webp` format and specify dimensions
- **Optimization**: Run images through [squoosh.app](https://squoosh.app) before adding
- **Fonts**: Already using `display=swap` for Google Fonts
- Blog post images should go in `public/images/blog/`

## Adding More Pages

Create new `.astro` files in `src/pages/`:

```astro
---
// src/pages/uses.astro
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
---

<Layout title="Uses | Sean Campbell">
  <Nav />
  <main class="container" style="padding-top: 120px;">
    <!-- Your content -->
  </main>
  <Footer />
</Layout>
```

## Roadmap page (`/roadmap`)

A public learning roadmap with a shared, persisted progress state.

- **Content** lives in `src/data/roadmap.ts` (single source of truth).
- **Progress** is stored in Netlify Blobs (store `roadmap`, key `progress`) via the
  `netlify/functions/progress.ts` function. `GET /api/progress` is public; `POST` is
  gated by a bearer token.
- **Edit mode**: on `/roadmap`, click **Edit** and enter `ROADMAP_ADMIN_TOKEN`. The token
  is kept in `sessionStorage` and sent only to the API — it never ships in the client bundle.

### Environment

Set `ROADMAP_ADMIN_TOKEN` (a long random secret) in:

- the Netlify site environment variables (Site settings → Environment variables), and
- a local `.env` file for development (see `.env.example`).

### Local development

Blobs require the Netlify environment, so run the dev server through the Netlify CLI:

```bash
netlify dev
```

`npm run dev` (plain Astro) serves the page but the `/api/progress` calls will fail because
Blobs are not configured outside `netlify dev`.

## Tech Stack

- [Astro](https://astro.build) - Static site generator
- [MDX](https://mdxjs.com) - Markdown with components
- [Lucide Icons](https://lucide.dev) - Icon library (inlined SVGs)
- CSS - Custom properties, no frameworks
- [Netlify](https://netlify.com) - Hosting & deployment

## License

MIT
