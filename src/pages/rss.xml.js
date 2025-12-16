import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  const publishedPosts = posts.filter(post => !post.data.draft);
  
  return rss({
    title: 'Sean Campbell | Blog',
    description: 'Thoughts on software engineering, architecture patterns, and lessons from production systems.',
    site: context.site,
    items: publishedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
