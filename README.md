# Sean Campbell Portfolio

A modern, fast, and content-driven portfolio site built with [Astro](https://astro.build).

## Features

- ⚡ **Lightning fast** - Ships zero JS by default
- 📝 **Blog ready** - MDX support with content collections
- 🎨 **Sleek design** - Dark theme with subtle animations
- 📱 **Fully responsive** - Mobile-first approach
- 🔍 **SEO optimized** - Meta tags, sitemap, and semantic HTML
- 🚀 **Deploy anywhere** - Configured for Netlify

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
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Beyond.astro        # Community involvement section
│   │   ├── Contact.astro       # Contact CTA
│   │   ├── Currently.astro     # What I'm building now
│   │   ├── Footer.astro
│   │   ├── Hero.astro          # Homepage hero
│   │   ├── Nav.astro           # Navigation
│   │   ├── Projects.astro      # Case study cards
│   │   └── Testimonial.astro
│   ├── content/
│   │   └── blog/               # Blog posts (MDX)
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

## Customization

### Personal Information

Edit the component files in `src/components/` to update:

- **Hero.astro** - Name, title, tagline, tech stack, stats
- **Beyond.astro** - Speaking, teaching, open source contributions
- **Projects.astro** - Case studies with problem/solution/tradeoffs/impact
- **Testimonial.astro** - Quote, author name, title
- **Currently.astro** - What you're learning/building
- **Contact.astro** - Email address, headline
- **Footer.astro** - Social links

### Site Config

Update `astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://yourdomain.com', // Your domain
  // ...
});
```

### Colors & Typography

Edit CSS variables in `src/styles/global.css`:

```css
:root {
  --color-accent: #60a5fa;        /* Primary accent */
  --color-accent-secondary: #a78bfa; /* Secondary accent */
  /* ... */
}
```

## Adding Blog Posts

Create new `.mdx` files in `src/content/blog/`:

```mdx
---
title: "Your Post Title"
description: "A brief description"
pubDate: 2024-12-15
tags: ["Tag1", "Tag2"]
heroImage: "/images/post-hero.jpg" # Optional
draft: false # Set to true to hide
---

Your content here with full MDX support.
```

## Deployment to Netlify

### Option 1: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy (creates new site)
netlify deploy --prod
```

### Option 2: Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Log in to [Netlify](https://app.netlify.com)
3. Click "New site from Git"
4. Select your repository
5. Build settings are auto-detected from `netlify.toml`
6. Click "Deploy site"

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

- Images: Use `.webp` format and specify dimensions
- Fonts: Already using `display=swap` for Google Fonts
- Assets in `public/` are served as-is (good for images)
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
  <main>
    <!-- Your content -->
  </main>
  <Footer />
</Layout>
```

## Tech Stack

- [Astro](https://astro.build) - Static site generator
- [MDX](https://mdxjs.com) - Markdown with components
- CSS - Custom properties, no frameworks needed
- [Netlify](https://netlify.com) - Hosting & deployment

## License

MIT
