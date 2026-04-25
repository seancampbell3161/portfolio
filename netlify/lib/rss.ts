import { XMLParser } from "fast-xml-parser";

export type RssItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string; // ISO 8601 (parsed)
};

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

export function parseRssXml(xml: string): RssItem[] {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) return [];
  const raw = channel.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map((it: any) => ({
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
    link: String(it.link ?? ""),
    pubDate: new Date(String(it.pubDate ?? "")).toISOString(),
  }));
}

export function diffNewItems(
  items: RssItem[],
  lastSentPubDate: string | null,
): RssItem[] {
  const cutoff = lastSentPubDate ? new Date(lastSentPubDate).getTime() : -Infinity;
  return items
    .filter((i) => new Date(i.pubDate).getTime() > cutoff)
    .sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
}

export async function fetchRss(siteUrl: string): Promise<RssItem[]> {
  const res = await fetch(`${siteUrl.replace(/\/$/, "")}/rss.xml`);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  return parseRssXml(await res.text());
}
