import { describe, it, expect } from "vitest";
import { diffNewItems, parseRssXml, type RssItem } from "../rss.js";

const item = (title: string, slug: string, pubDate: string): RssItem => ({
  title,
  description: title,
  link: `https://example.com/blog/${slug}/`,
  pubDate,
});

describe("diffNewItems", () => {
  it("returns items strictly newer than lastSentPubDate, oldest first", () => {
    const items = [
      item("C", "c", "2026-03-01T00:00:00Z"),
      item("A", "a", "2026-01-01T00:00:00Z"),
      item("B", "b", "2026-02-01T00:00:00Z"),
    ];
    const out = diffNewItems(items, "2026-01-15T00:00:00Z");
    expect(out.map((i) => i.title)).toEqual(["B", "C"]);
  });

  it("returns nothing when lastSentPubDate is the newest", () => {
    const items = [item("A", "a", "2026-01-01T00:00:00Z")];
    expect(diffNewItems(items, "2026-01-01T00:00:00Z")).toEqual([]);
  });

  it("returns everything when lastSentPubDate is null", () => {
    const items = [
      item("A", "a", "2026-01-01T00:00:00Z"),
      item("B", "b", "2026-02-01T00:00:00Z"),
    ];
    const out = diffNewItems(items, null);
    expect(out.map((i) => i.title)).toEqual(["A", "B"]);
  });
});

describe("parseRssXml", () => {
  it("extracts title, link, description, pubDate from a minimal RSS document", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Hello</title>
    <link>https://example.com/blog/hello/</link>
    <description>desc</description>
    <pubDate>Wed, 01 Apr 2026 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`;
    const items = parseRssXml(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Hello");
    expect(items[0].link).toBe("https://example.com/blog/hello/");
    expect(items[0].description).toBe("desc");
    expect(new Date(items[0].pubDate).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("returns an empty array for a feed with no items", () => {
    const xml = `<?xml version="1.0"?><rss><channel></channel></rss>`;
    expect(parseRssXml(xml)).toEqual([]);
  });
});
