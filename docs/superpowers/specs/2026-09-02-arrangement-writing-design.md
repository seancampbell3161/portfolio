# Arrangement, sub-project 2: Writing

Design spec, 2026-09-02. Approved section by section in brainstorming the same day.

## 1. Context

This is the second of the four sub-projects that carry the Arrangement redesign across seanthedeveloper.com. The first, `docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md`, set the language (a studio console: lanes on a time axis, clips, a playhead at now, an inspector), the tokens, the transport bar, the footer, and the timeline data model in `src/lib/timeline/`. Since it shipped, the blog pages wear the new palette and bar over their old structure: a card grid for the index and a centred column for each post.

This sub-project replaces that structure. The deciding idea from the redesign still applies: every essay carries a lane and a date, so its neighbours and what was being built around it compute themselves from the timeline.

## 2. Scope

In scope:

- The writing index at `/blog`.
- The essay page at `/blog/<slug>`.
- The newsletter component, restyled with its markup and script unchanged.
- UTC formatting for every date the blog prints.
- The screenshot script extended to the writing pages.
- A line in `CLAUDE.md` for the writing pages.

Declined for this sub-project on 2026-09-02: tag pages or filtering, a table of contents, series grouping. Left to sub-project 4: regenerated share images, the newsletter confirmation pages, the 404 page. The RSS feed and the roadmap page are untouched.

## 3. Decisions from brainstorming

- **The index is the Writing lane as a vertical track**, the idiom the home page uses on phones: a gold track down the left, a node per essay, now at the top. Chosen over a horizontal position strip above a dated log, and over the home page's Writing lane lifted out above a log. Its argument is one layout at every width. Its known cost is that the track has no time scale: nine days and five months look the same, which the date column and year rows compensate for.
- **The essay page has no strip.** Position lives in the sidebar as a short segment of the same track: this essay ringed between its newer and older neighbours. It doubles as previous and next, keeps one idiom for the lane on both pages, and saves the height a strip would take above the title. This supersedes the position strip described for the essay page in the foundation spec.
- Reference mockups (gitignored, in the `arrangement-foundation` worktree): `.superpowers/brainstorm/44572-1788374997/content/index-layout-v2.html` and `essay-position-v2.html`.

## 4. Writing index

The page keeps its URL, its share image (`ogImagePath("blog")`), and its meta description. Its title becomes "Writing | Sean Campbell". Top padding clears the fixed transport bar as it does today.

Top to bottom at 900px and wider:

1. The transport bar with Writing underlined, no zoom control and no date (the bar's `showZoom` stays false here).
2. The page head. Left: the h1 "Writing" in the display face, then the two existing lines of copy verbatim: "Thoughts and lessons learned along my Software Engineering journey." and the AI note that follows it today. Right, bottom-aligned, in mono and muted: the count on one line ("5 essays", or "1 essay") and the range on the next ("Dec 2025 to Sep 2026", earliest to latest publish month; a single month prints once).
3. The track (§6), built from every published essay newest first: a now row, then a year row before the first essay of each year, then the essay rows. Each essay row carries the date and reading time in the mono column and the title, description, and tags in the body.
4. The newsletter panel (§9) with its current heading and blurb on this page ("Stay in the loop", "Get new posts in your inbox. No spam, unsubscribe anytime.").
5. The footer.

Drafts are excluded in production and included in development, exactly as today. The current empty state, with its list of upcoming topics, is removed; with zero essays the track shows only the now row and the newsletter follows.

The track and the newsletter sit in a centred column with a maximum width of 960px and 40px side padding. No cards, no tag pills, no hero images on the index.

Below 900px the column padding drops to 20px, the gutter narrows, and the mono column collapses into one line above the title ("01 Sep, 5 min").

## 5. Essay page

The page title, meta description, and share image are unchanged ("{title} | Sean Campbell", the description, the hero image when present). Top padding clears the fixed transport bar as it does today. At 900px and wider the page is a grid: the article column and a 280px sidebar with a 56px gap, centred at a maximum of 1160px with 40px side padding. Below 900px it is one column in this order: article, newsletter, sidebar, footer.

The article column, top to bottom:

1. A kicker line in muted 13px text with an 8px gold square: "Essay, 1 September 2026, 5 minute read". With an updated date it continues ", updated 3 March 2027". One minute reads "1 minute read".
2. The h1 in the display face at `clamp(2.4rem, 4.8vw, 3.6rem)`, weight 700, line height 1, letter spacing -0.025em.
3. The description as a standfirst: 21px, line height 1.45, `--color-text-secondary`.
4. The tags as one muted 13px line, comma separated. Omitted when the post has no tags.
5. The hero image when the post has one: full column width, 4px radius, empty alt. No post uses one today; support stays.
6. The body (below).
7. The newsletter panel with this page's current heading and blurb ("Like this? Subscribe.", "Get new posts in your inbox. No spam, unsubscribe anytime.").

The back link at the foot of today's post is removed. The track segment and the transport bar both lead back to the index.

The sidebar, top to bottom:

1. A kicker "Writing" with a gold square, then the track segment (§7).
2. A kicker "Written while" with a muted square, then the list (§8). The whole block is omitted when the list is empty.

Body typography. A new token `--color-text-reading: #DDDBD4` is added to `src/styles/global.css` for long-form text; it sits between primary and secondary. The body is Instrument Sans at 17.5px, line height 1.65, in that colour, with paragraphs on a 60ch measure and 22px below. Headings inside the body use the display face: h2 at 26px with 48px above and 16px below, h3 at 20px with 32px above and 12px below, both in `--color-text-primary`. Links are `--lane-writing` with a 1px bottom border at 40% of that colour, turning to `--color-text-primary` on hover. Inline code is mono at 0.9em on `--color-bg-elevated` with 3px radius. Code blocks sit on `--color-bg-elevated` (overriding Shiki's inline theme background) with a 1px `--color-border`, 4px radius, 24px padding; long lines wrap, as the site's Shiki config already chose. Blockquotes have a 3px `--lane-writing` left border, 20px left padding, 19px italic text in `--color-text-primary`. Lists keep 32px left padding. Images and video take 4px radius and full width. A horizontal rule is a 1px `--color-border` line with 32px above and below. Strong text is `--color-text-primary`.

## 6. The track

`src/components/Track.astro` renders an ordered list from an array of rows. It is the one component for the index and the sidebar segment. Its props are `{ rows: TrackRow[]; density: "index" | "segment"; label?: string }`: the rows say what to print, the density says which grid to print it in, and the label becomes the list's `aria-label` ("Essays" on the index, "Nearby essays" in the sidebar). (Brainstorming suggested inferring density from the rows; an index with no essays would then flip to the segment grid, so the prop is explicit.)

The row builders take essays in this shape, which both the blog collection and the writing lane of the timeline can supply:

```ts
export interface Essay {
  id: string;        // `essay-<slug>`, as fromBlog produces
  href: string;      // `/blog/<slug>`
  title: string;
  date: Date;        // pubDate
  description?: string;
  tags?: string[];
  minutes?: number;
}

export type TrackRow =
  | { kind: "now"; label: string }
  | { kind: "year"; label: string }
  | { kind: "more"; label: string; href: string }
  | {
      kind: "essay";
      id: string;
      href: string;
      title: string;
      date: Date;
      current?: boolean;
      minutes?: number;
      description?: string;
      tags?: string[];
    };
```

Rendering:

- The list is an `<ol>` with one `<li>` per row. The gutter is a CSS pseudo-element on each item: a 2px vertical line in `--lane-writing` at 55% over the page background, and a 12px round node per row. The now node is `--color-text-primary`. A more node is an outlined ring. The current essay's node carries a 3px ring at 35% of the lane colour, and its title is in `--lane-writing`.
- A now row prints "now" in the mono column and the label ("Sep 2, 2026", the build date) in the body, mono and muted.
- A year row prints its label in the mono column, and nothing else.
- A more row prints its label as a link to its href, in `--lane-writing` with the 40% underline.
- An essay row is one link. At index density the mono column holds the day ("01 Sep") over the minutes ("5 min", faint); the body holds the title as an h2 in the display face at 26px weight 600, the description at 16px in `--color-text-secondary` on a 60ch measure, and the tags line at 13px muted. Description and tags are printed only when present. At segment density there is no mono column: the row holds the title at 14px weight 500 and the date ("01 Sep 2026") in mono under it, and a now row prints "now, Sep 2, 2026" on one line.
- The whole essay row is clickable and there is exactly one link in it: the title anchor, extended over the row with an absolutely positioned pseudo-element. Hover turns the title to `--lane-writing`. The current row carries `aria-current="page"`.
- Focus is a 2px outline in `--lane-writing` with 2px offset.
- Index density at 900px and wider: 48px gutter, 120px mono column, body. Below: 28px gutter and body, with the mono column's content as one line above the title. Segment density is always 28px gutter and body.

The index rows come from `indexRows(essays, now)` in `src/lib/timeline/track.ts`: a now row, then for each essay in publish order newest first, a year row when the essay's UTC year differs from the previous row's, then the essay row. Every year gets a row, including the first.

## 7. The track segment

`segmentRows(essays, currentId, now)` in `src/lib/timeline/track.ts`; `now` labels the now row. Essays are sorted newest first, ties by id. With `i` the index of the current essay and `n` the count:

1. When `i` is 0, a now row; otherwise a more row labelled "{i} newer, all essays" linking to `/blog` ("1 newer" in the singular).
2. When `i` is greater than 0, the essay row for `essays[i - 1]`.
3. The essay row for the current essay, marked current.
4. When `i` is less than `n - 1`, the essay row for `essays[i + 1]`.
5. When `n - i - 2` is greater than 0, a more row labelled "{n - i - 2} older, all essays" linking to `/blog`.

Segment essay rows carry id, href, title, and date only. An unknown `currentId` throws; the route only calls it with ids the timeline produced.

## 8. Written while

`writtenWhile(items, published, now)` in `src/lib/timeline/track.ts` returns the timeline items from the building, learning, and community lanes that overlap the publish date:

- A span (an item with an end, or in progress without one) counts when its start is on or before the publish date and its effective end (`effectiveEnd` from `layout.ts`: the end, or now) is on or after it.
- A moment counts when its start is within 14 days of the publish date, inclusive, in either direction.

Order: building, then learning, then community; within a lane by start ascending, ties by id. Each row shows the lane's square, the title as a link to the item's href (the home inspector deep link for every non-essay item), and a second line "{lane}, {status}" with the status words done, live, in progress, planned.

The stage and chapter detail shown in the earlier mockups ("AOF stage", "chapter 5") arrives with sub-project 3, when the Learning lane is derived from the roadmap.

## 9. Newsletter

`src/components/Newsletter.astro` keeps its props, markup, and submit script. Only the styles change:

- The section is a panel: `--color-bg-elevated`, a 1px `--color-border`, a 3px left border in `--lane-writing`, 4px radius, 26px by 28px padding. It fills its container; the pages decide the width.
- At 900px and wider it is two columns, text left and form right, vertically centred, 32px gap. Below it stacks.
- The heading is the display face at 24px weight 600. The blurb is 15px `--color-text-secondary`.
- The input has `--color-bg` behind it, a 1px `--color-border`, 4px radius, 11px by 14px padding; focus turns the border `--lane-writing`.
- The button is `--lane-writing` with `--color-bg` text at weight 500, 4px radius, 11px by 18px padding. Hover lightens it by mixing 12% white. No transform. Disabled stays at 60% opacity.
- The status line keeps its states: success in `--lane-writing`, error in the current `#ff7676`.

## 10. Reading time

`readingMinutes(body)`: split the MDX source on whitespace, count non-empty tokens, divide by 220, round, floor at 1. Import lines and JSX count a little; that is accepted.

## 11. Dates

Content dates are UTC midnight, so every formatter uses UTC. `src/lib/dates.ts` exports:

- `longDate(d)` → "1 September 2026"
- `shortDay(d)` → "01 Sep"
- `shortDate(d)` → "01 Sep 2026"
- `monthYear(d)` → "Sep 2026"
- `monthDayYear(d)` → "Sep 2, 2026"
- `isoDay(d)` → "2026-09-01", for `<time datetime>`

The Inspector keeps its own UTC formatting for now; moving it onto this module is a sub-project 4 tidy-up.

## 12. Files

New:

- `src/lib/timeline/track.ts`: `Essay`, `TrackRow`, `sortEssays`, `indexRows(essays, now)`, `segmentRows(essays, currentId, now)`, `writtenWhile(items, published, now)`, `readingMinutes(body)`.
- `src/lib/timeline/__tests__/track.test.ts`.
- `src/lib/dates.ts` and `src/lib/__tests__/dates.test.ts`.
- `src/components/Track.astro`.

Rewritten:

- `src/pages/blog/index.astro`: loads the blog collection as today, computes minutes per post, builds the rows, renders head, Track, Newsletter, Footer.
- `src/pages/blog/[...slug].astro`: keeps `getStaticPaths`; per page calls `getTimeline()`, derives the essays from the writing lane, and passes `entry`, `minutes`, `segment`, and `writtenWhile` to the layout.
- `src/layouts/BlogPost.astro`: props `{ entry: CollectionEntry<"blog">; minutes: number; segment: TrackRow[]; writtenWhile: TimelineItem[] }`, with the rendered content in its default slot.

Changed:

- `src/components/Newsletter.astro`: styles only.
- `src/styles/global.css`: adds `--color-text-reading`.
- `scripts/home-screenshots.mjs` becomes `scripts/screenshots.mjs` and shoots `/`, `/blog`, and `/blog/i-wont-stop-coding` at 1280 and 390 wide. The `shots` npm script points at it.
- `CLAUDE.md`: the architecture section describes the writing pages and the track.

The essay id produced by `fromBlog` is `essay-<slug>`; the route uses it to find the current essay.

## 13. Accessibility

The track is a real list, so a screen reader hears the count and each row in order. The gutter is decorative and lives in pseudo-elements. Every essay row has one link, and the current row in the segment carries `aria-current="page"`. Dates are `<time>` elements with ISO `datetime`. Focus rings are visible on every link and on the newsletter's controls. Nothing on these pages animates.

## 14. Testing

Vitest, in `src/lib/timeline/__tests__/track.test.ts`:

- `indexRows`: the now row first; a year row before the first essay and before each year change; essays newest first.
- `segmentRows`: the newest essay gets a now head and an older tail with the right count; a middle essay gets newer and older more rows with the right counts; the oldest gets no tail; a single essay yields now and itself; singular labels; unknown id throws.
- `writtenWhile`: a span containing the date, a span ending the day before (excluded), an in-progress span with no end, a moment 14 days away (included) and 15 days away (excluded), a writing item (excluded), lane ordering and within-lane ordering.
- `readingMinutes`: empty body gives 1, 330 words give 2, 110 words give 1.

`src/lib/__tests__/dates.test.ts`: each formatter on `2026-09-01T00:00:00Z` and `2025-12-31T00:00:00Z`, which must print 1 September and 31 December in every time zone.

Build: `npm run build` succeeds and `npm run shots` writes eight images against the preview server. The newsletter form is checked by hand in the preview: its request still goes to `/api/subscribe`.

## 15. Inputs needed during implementation

None. Every value on these pages is computed from content that already exists.
