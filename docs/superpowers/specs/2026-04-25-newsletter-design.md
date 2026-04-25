# Newsletter Design

**Status:** Draft
**Date:** 2026-04-25
**Owner:** Sean Campbell

## Goal

Replace the existing Substack newsletter with a self-hosted newsletter feature on the portfolio site. Visitors can subscribe with their email; when a new blog post is published, confirmed subscribers automatically receive an email with the post's title, description, and a link back to the site.

The system must:

- Run on the existing Netlify hosting with no new subscription services
- Preserve the site's static-by-default architecture (no Astro SSR adapter, no client JS outside the signup form itself)
- Support double opt-in for compliance and list quality
- Send broadcasts automatically when new posts publish — no per-post manual step

The existing Substack remains live for its current subscribers; no migration is performed.

## Approach

**Stack:** Netlify Functions + Netlify Blobs + Resend.

- **Netlify Functions** (`netlify/functions/`) host four endpoints: subscribe, confirm, unsubscribe, and a scheduled send-newsletter job. Functions are added directly without an Astro SSR adapter — the Astro site continues to build to fully static HTML.
- **Netlify Blobs** stores subscriber records and a small state singleton tracking which posts have already been broadcast.
- **Resend** sends transactional confirmation emails and newsletter broadcasts. Sending domain is `seanthedeveloper.com` (matching the existing contact email and Google Workspace domain). Resend's outbound auth records (SPF, DKIM) coexist with Workspace's inbound MX records.

Estimated cost at expected scale (sub-1000 subscribers, ~1 post/month): $0/mo, well within Netlify's and Resend's free tiers.

## Data Model

Single Netlify Blobs store named `newsletter` with two record shapes.

### Subscriber

Key: lowercased email address.

```ts
type Subscriber = {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
  createdAt: string;        // ISO 8601
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  confirmToken: string | null;   // 32-byte hex; cleared after confirmation
  unsubscribeToken: string;      // 32-byte hex; permanent
};
```

### State singleton

Key: `__state`.

```ts
type State = {
  lastSentPubDate: string;       // ISO 8601 — pubDate of newest post broadcast
  sendingLockUntil: string | null; // ISO 8601 — expires lock if a run crashes
};
```

### Rate-limit records

Key: `__ratelimit:<ip>`.

```ts
type RateLimit = {
  attempts: number;
  windowStart: string;  // ISO 8601
};
```

## Endpoints

All endpoints live in `netlify/functions/`. Each is a TypeScript file exporting a `handler`.

By default Netlify exposes functions at `/.netlify/functions/<name>`. To get the cleaner `/api/<name>` URLs used throughout this spec, add to `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

This redirect must be ordered **before** the existing catch-all `/* → /404` rule.

### `POST /api/subscribe`

Body: `{ email: string }`.

1. Validate email (regex + bundled disposable-domain blocklist).
2. Apply per-IP rate limit: 5 attempts per 10 minutes; over the limit returns `429`.
3. Look up existing record by lowercased email.
4. State machine:
   - **No record:** create with `status: "pending"`, generate both tokens, send confirmation email.
   - **`pending`:** regenerate `confirmToken`, resend confirmation email (rate-limited).
   - **`confirmed`:** silent success (return `200` without sending — avoids leaking subscription status).
   - **`unsubscribed`:** revert to `pending`, generate fresh `confirmToken`, send confirmation email.
5. Return `{ ok: true }` on success.

### `GET /api/confirm?token=<hex>`

1. Scan subscribers for matching `confirmToken`. (At expected scale, full scan is acceptable. If volume grows, add a `__token:<token>` → email index.)
2. If found: set `status: "confirmed"`, set `confirmedAt`, clear `confirmToken`. Redirect to `/newsletter/confirmed`.
3. If not found: redirect to `/newsletter/error`.

### `GET /api/unsubscribe?token=<hex>`

1. Scan subscribers for matching `unsubscribeToken`.
2. If found: set `status: "unsubscribed"`, set `unsubscribedAt`. Redirect to `/newsletter/unsubscribed`.
3. If not found: redirect to `/newsletter/error`.

### Scheduled `send-newsletter`

Runs every 15 minutes via Netlify scheduled function (`*/15 * * * *`).

1. Acquire send lock: read `state`; if `sendingLockUntil` is in the future, abort. Otherwise set `sendingLockUntil = now + 10min` and write.
2. Fetch `${SITE_URL}/rss.xml`, parse items (use a minimal RSS parser — `fast-xml-parser` or hand-rolled).
3. Filter to items where `pubDate > state.lastSentPubDate`. Sort ascending by `pubDate`.
4. **Bootstrap rule:** if `state.lastSentPubDate` is missing (first run ever), set it to the newest item's `pubDate` *without sending*, then exit. This prevents back-blasting the entire archive when the feature goes live.
5. For each new item, oldest first:
   - Iterate confirmed subscribers; for each, send a **per-recipient** email via Resend (one API call per subscriber). We cannot batch via BCC because each email body contains a subscriber-specific unsubscribe link built from that subscriber's `unsubscribeToken`.
   - Per-recipient send failures are logged and skipped; they do not abort the broadcast.
   - On success: update `state.lastSentPubDate` to that item's `pubDate` and persist before moving to the next item.
6. Clear `sendingLockUntil` on completion.

## Email Templates

Both templates are TypeScript template literals — no `react-email` or other rendering dependency. Each email includes a `text/plain` alternative for deliverability.

### Confirmation email

- **Subject:** "Confirm your subscription to Sean Campbell's blog"
- **Body:** Brief greeting, single CTA button linking to `${SITE_URL}/api/confirm?token=...`, fallback plain-text URL.

### Post notification email

- **Subject:** post title
- **Body:** rendered fresh per recipient so the unsubscribe token matches that subscriber:
  - Post title (linked to `${SITE_URL}/blog/<slug>/`)
  - Post description
  - "Read on the site →" CTA
  - Footer: short blurb + unsubscribe link `${SITE_URL}/api/unsubscribe?token=<recipient.unsubscribeToken>`

## UI

### `src/components/Newsletter.astro`

Email input + submit button + inline message area. On submit, a small inline `<script>` posts JSON to `/api/subscribe` and updates the message area in place. Styled to match existing card aesthetic (`var(--color-bg-elevated)`, `var(--radius-xl)`, `var(--color-accent)` button).

This is the **only** client-side JS the site ships, and it's only present on pages that include the component.

### Placement

- `src/pages/blog/index.astro`:
  - Replace the "Get notified when I publish" CTA inside the empty-state block.
  - When posts exist, render a Newsletter card above the post grid.
- `src/layouts/BlogPost.astro`: render a Newsletter card at the bottom of every post.

### New static pages

- `src/pages/newsletter/confirmed.astro` — "You're subscribed."
- `src/pages/newsletter/unsubscribed.astro` — "You've been unsubscribed."
- `src/pages/newsletter/error.astro` — "That link is invalid or expired."

All three reuse `Layout.astro` and `Nav.astro` for consistency.

### Footer change

`src/components/Footer.astro`: replace the Substack icon-link with a link to `/blog`. The `'substack'` icon entry is removed; the icon import stays in `Icon.astro` in case it's needed later.

## Configuration

Netlify environment variables (set via the Netlify dashboard):

| Variable | Example |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `RESEND_FROM` | `Sean Campbell <newsletter@seanthedeveloper.com>` |
| `SITE_URL` | `https://seancampbell.dev` |

One-time manual setup:

1. Add `seanthedeveloper.com` as a verified sending domain in Resend.
2. Add the SPF, DKIM, and DMARC DNS records Resend provides to HostGator's DNS panel for `seanthedeveloper.com`. These do not conflict with the existing Google Workspace MX records.
3. Send a test broadcast manually before go-live.

## Error Handling & Abuse

- **Email validation:** RFC-light regex + bundled list of common disposable-email domains.
- **Subscribe rate limit:** 5 attempts per IP per rolling 10-minute window. Stored in Blobs under `__ratelimit:<ip>`.
- **Confirm-resend rate limit:** while a record is `pending`, additional subscribe POSTs reuse the existing record but only re-send the confirmation email if more than 60 seconds have elapsed since the last attempt.
- **Send lock:** `sendingLockUntil` prevents two overlapping cron invocations from double-broadcasting. Lock auto-expires after 10 minutes if a run crashes.
- **Per-recipient send failures:** logged with the subscriber email and Resend error code; do not abort the broadcast.
- **Token format:** 32-byte hex (`crypto.randomBytes(32).toString('hex')`). No expiration — old confirmation links stay valid indefinitely. Simplifies UX at the cost of a small theoretical attack window if a token leaks.
- **Idempotency:** subscribing while already confirmed returns success without sending; subscribing while pending re-sends (rate-limited); subscribing after unsubscribing reactivates as pending.

## Testing

### Unit

- Email validation (valid, invalid, disposable-domain rejection)
- Token generation (length, randomness sanity)
- RSS-diff logic: given a `lastSentPubDate` and a list of items, return the correct subset in the correct order
- Subscriber state-machine transitions

### Integration

- Subscribe → confirm → unsubscribe round trip via `netlify dev` with the local Blobs emulator
- Subscribe rate-limit kicks in after 5 attempts
- Bootstrap rule on first run does not send

### Manual

- Trigger the scheduled function with `netlify functions:invoke send-newsletter`
- Verify confirmation and unsubscribe links work end-to-end
- Verify email rendering in Gmail (web), Apple Mail (macOS, iOS)
- Verify SPF/DKIM pass via Gmail's "Show original" view

## Out of scope (v1)

- Admin dashboard / web UI for managing subscribers — query Blobs directly via Netlify CLI when needed.
- Subscriber import from Substack.
- Personal-intro field on posts (the "Hybrid" content option). Trivial to add later: optional `newsletterIntro` frontmatter field, included in the broadcast body when present.
- Bounce / complaint webhook handling from Resend. Add when first bounce surfaces.
- Open / click tracking. Out of step with the privacy-friendly tone of the site.
- A/B subject testing, segmentation, scheduled send times — none of which apply at this scale.

## Open questions

None at spec-write time. All decisions captured above.
