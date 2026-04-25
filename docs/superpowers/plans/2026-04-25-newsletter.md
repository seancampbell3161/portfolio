# Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-host the blog newsletter on Netlify Functions + Netlify Blobs + Resend, replacing the current Substack while keeping the Astro site fully static.

**Architecture:** Astro stays static. Netlify Functions (added directly under `netlify/functions/`, no Astro SSR adapter) handle subscribe/confirm/unsubscribe and a scheduled send job. Subscriber state lives in Netlify Blobs. Resend sends the actual email. Each function is a thin wrapper around a pure handler in `netlify/lib/handlers/` so business logic is unit-testable with injected `Storage` and `EmailSender` deps.

**Tech Stack:** Astro 5, TypeScript, Netlify Functions (Web Fetch API style, v2), Netlify Blobs, Resend, fast-xml-parser (RSS), Vitest.

---

## File Structure

**Created:**

```
netlify/
  functions/
    subscribe.ts              # thin wrapper → handlers/subscribe.ts
    confirm.ts                # thin wrapper → handlers/confirm.ts
    unsubscribe.ts            # thin wrapper → handlers/unsubscribe.ts
    send-newsletter.ts        # thin wrapper, scheduled cron */15 * * * *
  lib/
    types.ts                  # Subscriber, State, RateLimit, Storage, EmailSender, Deps
    validation.ts             # isValidEmail()
    disposable-domains.ts     # bundled blocklist (Set<string>)
    tokens.ts                 # generateToken(), constantTimeEquals()
    ratelimit.ts              # checkRateLimit()
    rss.ts                    # fetchRss(), diffNewItems()
    templates.ts              # confirmationEmail(), postNotificationEmail()
    storage.ts                # blobsStorage() — real @netlify/blobs impl
    email.ts                  # resendSender() — real Resend impl
    handlers/
      subscribe.ts            # handleSubscribe(req, deps)
      confirm.ts              # handleConfirm(req, deps)
      unsubscribe.ts          # handleUnsubscribe(req, deps)
      send-newsletter.ts      # handleSendNewsletter(deps)
    __tests__/
      validation.test.ts
      tokens.test.ts
      ratelimit.test.ts
      rss.test.ts
      templates.test.ts
      handlers/
        subscribe.test.ts
        confirm.test.ts
        unsubscribe.test.ts
        send-newsletter.test.ts
        roundtrip.test.ts     # subscribe → confirm → unsubscribe end-to-end with in-memory deps
      helpers/
        memory-storage.ts     # in-memory Storage impl for tests
        fake-email.ts         # capturing EmailSender for tests

src/components/Newsletter.astro
src/pages/newsletter/confirmed.astro
src/pages/newsletter/unsubscribed.astro
src/pages/newsletter/error.astro

vitest.config.ts
docs/superpowers/runbooks/2026-04-25-newsletter-golive.md
```

**Modified:**

- `package.json` — add deps + test script
- `netlify.toml` — `/api/*` redirect (must precede 404 catch-all)
- `tsconfig.json` — include `netlify/**/*` for type-checking
- `src/components/Footer.astro` — replace Substack icon-link with `/blog`
- `src/pages/blog/index.astro` — add Newsletter card
- `src/layouts/BlogPost.astro` — add Newsletter card at end of post

---

## Task 1: Project setup — deps, vitest, netlify.toml, scripts

**Files:**
- Modify: `package.json`
- Modify: `netlify.toml`
- Create: `vitest.config.ts`

(No `tsconfig.json` change is needed: the existing `tsconfig.json` has no `include` block, so TypeScript automatically picks up `netlify/**/*.ts`.)

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
npm install @netlify/blobs resend fast-xml-parser
npm install -D vitest @types/node @netlify/functions typescript
```

- [ ] **Step 2: Add test script to `package.json`**

In the `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["netlify/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Add `/api/*` redirect to `netlify.toml`**

Insert this block **before** the existing `from = "/*"` 404 redirect:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

- [ ] **Step 5: Verify build still works**

Run: `npm run build`
Expected: build succeeds, `dist/` written.

- [ ] **Step 6: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: `No test files found, exiting with code 0` or similar success message.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json netlify.toml vitest.config.ts
git commit -m "chore: add netlify functions deps and vitest setup"
```

---

## Task 2: Shared types

**Files:**
- Create: `netlify/lib/types.ts`

- [ ] **Step 1: Write `netlify/lib/types.ts`**

```ts
export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export type Subscriber = {
  email: string;
  status: SubscriberStatus;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  confirmToken: string | null;
  unsubscribeToken: string;
};

export type State = {
  lastSentPubDate: string;
  sendingLockUntil: string | null;
};

export type RateLimitRecord = {
  attempts: number;
  windowStart: string;
};

export type Storage = {
  getSubscriber(email: string): Promise<Subscriber | null>;
  putSubscriber(s: Subscriber): Promise<void>;
  listSubscribers(): Promise<Subscriber[]>;
  findSubscriberByConfirmToken(token: string): Promise<Subscriber | null>;
  findSubscriberByUnsubscribeToken(token: string): Promise<Subscriber | null>;
  getState(): Promise<State | null>;
  putState(s: State): Promise<void>;
  getRateLimit(ip: string): Promise<RateLimitRecord | null>;
  putRateLimit(ip: string, r: RateLimitRecord): Promise<void>;
};

export type EmailSender = {
  sendConfirmation(args: {
    to: string;
    confirmUrl: string;
  }): Promise<void>;
  sendPostNotification(args: {
    to: string;
    postTitle: string;
    postDescription: string;
    postUrl: string;
    unsubscribeUrl: string;
  }): Promise<void>;
};

export type Clock = () => Date;

export type Deps = {
  storage: Storage;
  email: EmailSender;
  clock: Clock;
  siteUrl: string;
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add netlify/lib/types.ts
git commit -m "feat(newsletter): add shared types"
```

---

## Task 3: Email validation (TDD)

**Files:**
- Create: `netlify/lib/disposable-domains.ts`
- Create: `netlify/lib/validation.ts`
- Create: `netlify/lib/__tests__/validation.test.ts`

- [ ] **Step 1: Create disposable-domains list**

```ts
// netlify/lib/disposable-domains.ts
export const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "throwawaymail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "sharklasers.com",
  "spam4.me",
  "mailnesia.com",
  "mailcatch.com",
  "mintemail.com",
]);
```

- [ ] **Step 2: Write failing tests**

```ts
// netlify/lib/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { isValidEmail } from "../validation.js";

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("sean@example.com")).toBe(true);
  });

  it("accepts plus-addressing", () => {
    expect(isValidEmail("sean+blog@example.com")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("seanexample.com")).toBe(false);
  });

  it("rejects missing TLD", () => {
    expect(isValidEmail("sean@example")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidEmail("sean @example.com")).toBe(false);
  });

  it("is case-insensitive about disposable domains", () => {
    expect(isValidEmail("foo@Mailinator.COM")).toBe(false);
  });

  it("rejects disposable-domain emails", () => {
    expect(isValidEmail("foo@mailinator.com")).toBe(false);
    expect(isValidEmail("foo@10minutemail.net")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmail("  sean@example.com  ")).toBe(true);
  });

  it("rejects strings longer than 254 chars", () => {
    const long = "a".repeat(250) + "@x.co";
    expect(isValidEmail(long)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL — `Cannot find module '../validation.js'`.

- [ ] **Step 4: Implement `validation.ts`**

```ts
// netlify/lib/validation.ts
import { DISPOSABLE_DOMAINS } from "./disposable-domains.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  const email = input.trim();
  if (email.length === 0 || email.length > 254) return false;
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split("@")[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- validation`
Expected: all 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add netlify/lib/validation.ts netlify/lib/disposable-domains.ts netlify/lib/__tests__/validation.test.ts
git commit -m "feat(newsletter): add email validation with disposable-domain blocklist"
```

---

## Task 4: Token generation (TDD)

**Files:**
- Create: `netlify/lib/tokens.ts`
- Create: `netlify/lib/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// netlify/lib/__tests__/tokens.test.ts
import { describe, it, expect } from "vitest";
import { generateToken, constantTimeEquals } from "../tokens.js";

describe("generateToken", () => {
  it("returns a 64-char lowercase hex string (32 bytes)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is unique across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateToken());
    expect(set.size).toBe(100);
  });
});

describe("constantTimeEquals", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEquals("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tokens`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tokens.ts`**

```ts
// netlify/lib/tokens.ts
import { randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tokens`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/tokens.ts netlify/lib/__tests__/tokens.test.ts
git commit -m "feat(newsletter): add token generation"
```

---

## Task 5: Rate limit (TDD)

**Files:**
- Create: `netlify/lib/ratelimit.ts`
- Create: `netlify/lib/__tests__/helpers/memory-storage.ts` (used here and later)
- Create: `netlify/lib/__tests__/ratelimit.test.ts`

- [ ] **Step 1: Create in-memory Storage helper for tests**

```ts
// netlify/lib/__tests__/helpers/memory-storage.ts
import type {
  Storage,
  Subscriber,
  State,
  RateLimitRecord,
} from "../../types.js";

export function memoryStorage(): Storage & {
  _subs: Map<string, Subscriber>;
  _state: { current: State | null };
  _rates: Map<string, RateLimitRecord>;
} {
  const subs = new Map<string, Subscriber>();
  const state = { current: null as State | null };
  const rates = new Map<string, RateLimitRecord>();

  return {
    _subs: subs,
    _state: state,
    _rates: rates,

    async getSubscriber(email) {
      return subs.get(email.toLowerCase()) ?? null;
    },
    async putSubscriber(s) {
      subs.set(s.email.toLowerCase(), s);
    },
    async listSubscribers() {
      return [...subs.values()];
    },
    async findSubscriberByConfirmToken(token) {
      for (const s of subs.values()) if (s.confirmToken === token) return s;
      return null;
    },
    async findSubscriberByUnsubscribeToken(token) {
      for (const s of subs.values()) if (s.unsubscribeToken === token) return s;
      return null;
    },
    async getState() {
      return state.current;
    },
    async putState(s) {
      state.current = s;
    },
    async getRateLimit(ip) {
      return rates.get(ip) ?? null;
    },
    async putRateLimit(ip, r) {
      rates.set(ip, r);
    },
  };
}
```

- [ ] **Step 2: Write failing tests**

```ts
// netlify/lib/__tests__/ratelimit.test.ts
import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../ratelimit.js";
import { memoryStorage } from "./helpers/memory-storage.js";

const ten = (n: number) => new Date(`2026-04-25T12:${String(n).padStart(2, "0")}:00Z`);

describe("checkRateLimit", () => {
  it("allows the first attempt", async () => {
    const s = memoryStorage();
    const allowed = await checkRateLimit(s, "1.2.3.4", ten(0));
    expect(allowed).toBe(true);
  });

  it("allows up to 5 attempts in a 10-min window", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(s, "1.2.3.4", ten(i))).toBe(true);
    }
  });

  it("blocks the 6th attempt within the window", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.2.3.4", ten(i));
    expect(await checkRateLimit(s, "1.2.3.4", ten(9))).toBe(false);
  });

  it("resets after the 10-min window expires", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.2.3.4", ten(0));
    expect(await checkRateLimit(s, "1.2.3.4", ten(11))).toBe(true);
  });

  it("isolates per-IP", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.1.1.1", ten(i));
    expect(await checkRateLimit(s, "2.2.2.2", ten(5))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — verify failure**

Run: `npm test -- ratelimit`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `ratelimit.ts`**

```ts
// netlify/lib/ratelimit.ts
import type { Storage } from "./types.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function checkRateLimit(
  storage: Storage,
  ip: string,
  now: Date,
): Promise<boolean> {
  const existing = await storage.getRateLimit(ip);
  if (!existing || now.getTime() - new Date(existing.windowStart).getTime() > WINDOW_MS) {
    await storage.putRateLimit(ip, { attempts: 1, windowStart: now.toISOString() });
    return true;
  }
  if (existing.attempts >= MAX_ATTEMPTS) return false;
  await storage.putRateLimit(ip, {
    attempts: existing.attempts + 1,
    windowStart: existing.windowStart,
  });
  return true;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- ratelimit`
Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add netlify/lib/ratelimit.ts netlify/lib/__tests__/ratelimit.test.ts netlify/lib/__tests__/helpers/memory-storage.ts
git commit -m "feat(newsletter): add per-IP rate limiting"
```

---

## Task 6: RSS fetch + diff (TDD)

**Files:**
- Create: `netlify/lib/rss.ts`
- Create: `netlify/lib/__tests__/rss.test.ts`

- [ ] **Step 1: Write failing tests for the pure diff logic**

```ts
// netlify/lib/__tests__/rss.test.ts
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
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- rss`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rss.ts`**

```ts
// netlify/lib/rss.ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- rss`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/rss.ts netlify/lib/__tests__/rss.test.ts
git commit -m "feat(newsletter): add RSS fetch and diff"
```

---

## Task 7: Email templates (TDD)

**Files:**
- Create: `netlify/lib/templates.ts`
- Create: `netlify/lib/__tests__/templates.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// netlify/lib/__tests__/templates.test.ts
import { describe, it, expect } from "vitest";
import {
  confirmationEmail,
  postNotificationEmail,
} from "../templates.js";

describe("confirmationEmail", () => {
  it("includes the confirm URL in both html and text bodies", () => {
    const url = "https://seancampbell.dev/api/confirm?token=abc";
    const out = confirmationEmail({ confirmUrl: url });
    expect(out.subject).toMatch(/confirm/i);
    expect(out.html).toContain(url);
    expect(out.text).toContain(url);
  });
});

describe("postNotificationEmail", () => {
  it("includes title, description, post URL, and unsubscribe URL", () => {
    const out = postNotificationEmail({
      postTitle: "Hello",
      postDescription: "A blog post.",
      postUrl: "https://seancampbell.dev/blog/hello/",
      unsubscribeUrl: "https://seancampbell.dev/api/unsubscribe?token=xyz",
    });
    expect(out.subject).toBe("Hello");
    expect(out.html).toContain("Hello");
    expect(out.html).toContain("A blog post.");
    expect(out.html).toContain("https://seancampbell.dev/blog/hello/");
    expect(out.html).toContain("https://seancampbell.dev/api/unsubscribe?token=xyz");
    expect(out.text).toContain("https://seancampbell.dev/blog/hello/");
    expect(out.text).toContain("https://seancampbell.dev/api/unsubscribe?token=xyz");
  });

  it("html-escapes the post title to prevent injection", () => {
    const out = postNotificationEmail({
      postTitle: "<script>alert(1)</script>",
      postDescription: "x",
      postUrl: "https://example.com/",
      unsubscribeUrl: "https://example.com/u",
    });
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- templates`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `templates.ts`**

```ts
// netlify/lib/templates.ts
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function confirmationEmail(args: { confirmUrl: string }): RenderedEmail {
  const { confirmUrl } = args;
  const html = `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin-top: 0;">One more step</h2>
  <p>Confirm your subscription to Sean Campbell's blog:</p>
  <p><a href="${escape(confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#5fa8fc;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Confirm subscription</a></p>
  <p style="color:#666;font-size:14px;">Or paste this URL into your browser:<br/>${escape(confirmUrl)}</p>
  <p style="color:#999;font-size:12px;">Didn't sign up? You can ignore this email.</p>
</body></html>`;
  const text = `Confirm your subscription to Sean Campbell's blog:

${confirmUrl}

Didn't sign up? You can ignore this email.`;
  return {
    subject: "Confirm your subscription to Sean Campbell's blog",
    html,
    text,
  };
}

export function postNotificationEmail(args: {
  postTitle: string;
  postDescription: string;
  postUrl: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  const { postTitle, postDescription, postUrl, unsubscribeUrl } = args;
  const html = `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin-top: 0;"><a href="${escape(postUrl)}" style="color:#1a1a1a;text-decoration:none;">${escape(postTitle)}</a></h1>
  <p style="font-size:16px;color:#444;">${escape(postDescription)}</p>
  <p><a href="${escape(postUrl)}" style="display:inline-block;padding:12px 20px;background:#5fa8fc;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Read on the site →</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
  <p style="color:#999;font-size:12px;">You're getting this because you subscribed at seancampbell.dev. <a href="${escape(unsubscribeUrl)}" style="color:#999;">Unsubscribe</a>.</p>
</body></html>`;
  const text = `${postTitle}

${postDescription}

Read on the site: ${postUrl}

---
Unsubscribe: ${unsubscribeUrl}`;
  return { subject: postTitle, html, text };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- templates`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/templates.ts netlify/lib/__tests__/templates.test.ts
git commit -m "feat(newsletter): add confirmation and post notification templates"
```

---

## Task 8: Storage implementation (Netlify Blobs)

**Files:**
- Create: `netlify/lib/storage.ts`

This is a thin wrapper over `@netlify/blobs`. No unit tests — exercised via the round-trip handler test in Task 12 and manual verification.

- [ ] **Step 1: Implement `storage.ts`**

```ts
// netlify/lib/storage.ts
import { getStore } from "@netlify/blobs";
import type {
  Storage,
  Subscriber,
  State,
  RateLimitRecord,
} from "./types.js";

const STATE_KEY = "__state";
const RATE_PREFIX = "__ratelimit:";

export function blobsStorage(): Storage {
  const store = getStore("newsletter");

  const subKey = (email: string) => `sub:${email.toLowerCase()}`;

  return {
    async getSubscriber(email) {
      const v = await store.get(subKey(email), { type: "json" });
      return (v as Subscriber | null) ?? null;
    },
    async putSubscriber(s) {
      await store.setJSON(subKey(s.email), s);
    },
    async listSubscribers() {
      const out: Subscriber[] = [];
      const { blobs } = await store.list({ prefix: "sub:" });
      for (const b of blobs) {
        const v = await store.get(b.key, { type: "json" });
        if (v) out.push(v as Subscriber);
      }
      return out;
    },
    async findSubscriberByConfirmToken(token) {
      for (const s of await this.listSubscribers()) {
        if (s.confirmToken === token) return s;
      }
      return null;
    },
    async findSubscriberByUnsubscribeToken(token) {
      for (const s of await this.listSubscribers()) {
        if (s.unsubscribeToken === token) return s;
      }
      return null;
    },
    async getState() {
      const v = await store.get(STATE_KEY, { type: "json" });
      return (v as State | null) ?? null;
    },
    async putState(s) {
      await store.setJSON(STATE_KEY, s);
    },
    async getRateLimit(ip) {
      const v = await store.get(RATE_PREFIX + ip, { type: "json" });
      return (v as RateLimitRecord | null) ?? null;
    },
    async putRateLimit(ip, r) {
      await store.setJSON(RATE_PREFIX + ip, r);
    },
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add netlify/lib/storage.ts
git commit -m "feat(newsletter): add Netlify Blobs storage implementation"
```

---

## Task 9: Email sender (Resend) + fake helper

**Files:**
- Create: `netlify/lib/email.ts`
- Create: `netlify/lib/__tests__/helpers/fake-email.ts`

- [ ] **Step 1: Implement Resend sender**

```ts
// netlify/lib/email.ts
import { Resend } from "resend";
import type { EmailSender } from "./types.js";
import { confirmationEmail, postNotificationEmail } from "./templates.js";

export function resendSender(args: {
  apiKey: string;
  from: string;
}): EmailSender {
  const client = new Resend(args.apiKey);

  return {
    async sendConfirmation({ to, confirmUrl }) {
      const e = confirmationEmail({ confirmUrl });
      const { error } = await client.emails.send({
        from: args.from,
        to,
        subject: e.subject,
        html: e.html,
        text: e.text,
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
    },
    async sendPostNotification({ to, postTitle, postDescription, postUrl, unsubscribeUrl }) {
      const e = postNotificationEmail({ postTitle, postDescription, postUrl, unsubscribeUrl });
      const { error } = await client.emails.send({
        from: args.from,
        to,
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
    },
  };
}
```

- [ ] **Step 2: Create fake EmailSender for tests**

```ts
// netlify/lib/__tests__/helpers/fake-email.ts
import type { EmailSender } from "../../types.js";

export type CapturedEmail =
  | { kind: "confirmation"; to: string; confirmUrl: string }
  | {
      kind: "post";
      to: string;
      postTitle: string;
      postDescription: string;
      postUrl: string;
      unsubscribeUrl: string;
    };

export function fakeEmail(): EmailSender & { sent: CapturedEmail[] } {
  const sent: CapturedEmail[] = [];
  return {
    sent,
    async sendConfirmation({ to, confirmUrl }) {
      sent.push({ kind: "confirmation", to, confirmUrl });
    },
    async sendPostNotification(args) {
      sent.push({ kind: "post", ...args });
    },
  };
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add netlify/lib/email.ts netlify/lib/__tests__/helpers/fake-email.ts
git commit -m "feat(newsletter): add Resend email sender"
```

---

## Task 10: Subscribe handler + function wrapper (TDD)

**Files:**
- Create: `netlify/lib/handlers/subscribe.ts`
- Create: `netlify/lib/__tests__/handlers/subscribe.test.ts`
- Create: `netlify/functions/subscribe.ts`

- [ ] **Step 1: Write failing handler tests**

```ts
// netlify/lib/__tests__/handlers/subscribe.test.ts
import { describe, it, expect } from "vitest";
import { handleSubscribe } from "../../handlers/subscribe.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps } from "../../types.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

function deps(overrides: Partial<Deps> = {}): Deps {
  return {
    storage: memoryStorage(),
    email: fakeEmail(),
    clock: () => fixedNow,
    siteUrl: "https://seancampbell.dev",
    ...overrides,
  };
}

function req(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("https://seancampbell.dev/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": ip },
    body: JSON.stringify(body),
  });
}

describe("handleSubscribe", () => {
  it("returns 400 on invalid email", async () => {
    const d = deps();
    const res = await handleSubscribe(req({ email: "not-an-email" }), d);
    expect(res.status).toBe(400);
  });

  it("creates a pending subscriber and sends a confirmation email", async () => {
    const d = deps();
    const res = await handleSubscribe(req({ email: "sean@example.com" }), d);
    expect(res.status).toBe(200);

    const sub = await d.storage.getSubscriber("sean@example.com");
    expect(sub).not.toBeNull();
    expect(sub!.status).toBe("pending");
    expect(sub!.confirmToken).toMatch(/^[0-9a-f]{64}$/);
    expect(sub!.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);

    const sent = (d.email as any).sent;
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe("confirmation");
    expect(sent[0].to).toBe("sean@example.com");
    expect(sent[0].confirmUrl).toContain(`/api/confirm?token=${sub!.confirmToken}`);
  });

  it("lowercases the stored email", async () => {
    const d = deps();
    await handleSubscribe(req({ email: "Sean@Example.COM" }), d);
    expect(await d.storage.getSubscriber("sean@example.com")).not.toBeNull();
  });

  it("re-sends confirmation when subscribing again while pending", async () => {
    const d = deps();
    await handleSubscribe(req({ email: "sean@example.com" }), d);
    await handleSubscribe(req({ email: "sean@example.com" }, "2.2.2.2"), d);
    const sent = (d.email as any).sent;
    expect(sent).toHaveLength(2);
    expect(sent.every((e: any) => e.kind === "confirmation")).toBe(true);
  });

  it("returns 200 silently for an already-confirmed email without sending", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "confirmed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: fixedNow.toISOString(),
      unsubscribedAt: null,
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
    const res = await handleSubscribe(req({ email: "sean@example.com" }), d);
    expect(res.status).toBe(200);
    expect((d.email as any).sent).toHaveLength(0);
  });

  it("revives an unsubscribed record as pending and sends confirmation", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "unsubscribed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: null,
      unsubscribedAt: fixedNow.toISOString(),
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
    await handleSubscribe(req({ email: "sean@example.com" }), d);
    const sub = await d.storage.getSubscriber("sean@example.com");
    expect(sub!.status).toBe("pending");
    expect(sub!.confirmToken).toMatch(/^[0-9a-f]{64}$/);
    expect((d.email as any).sent).toHaveLength(1);
  });

  it("returns 429 when the IP is rate-limited", async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) {
      await handleSubscribe(req({ email: `a${i}@example.com` }, "9.9.9.9"), d);
    }
    const res = await handleSubscribe(req({ email: "a6@example.com" }, "9.9.9.9"), d);
    expect(res.status).toBe(429);
  });

  it("returns 400 on malformed JSON body", async () => {
    const d = deps();
    const r = new Request("https://seancampbell.dev/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nf-client-connection-ip": "1.1.1.1" },
      body: "{not json",
    });
    const res = await handleSubscribe(r, d);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- handlers/subscribe`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `handlers/subscribe.ts`**

```ts
// netlify/lib/handlers/subscribe.ts
import type { Deps, Subscriber } from "../types.js";
import { isValidEmail } from "../validation.js";
import { generateToken } from "../tokens.js";
import { checkRateLimit } from "../ratelimit.js";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export async function handleSubscribe(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid body" });
  }

  const rawEmail = typeof body?.email === "string" ? body.email : "";
  if (!isValidEmail(rawEmail)) return json(400, { error: "invalid email" });

  const ip = clientIp(req);
  const allowed = await checkRateLimit(deps.storage, ip, deps.clock());
  if (!allowed) return json(429, { error: "too many attempts" });

  const email = rawEmail.trim().toLowerCase();
  const now = deps.clock().toISOString();
  const existing = await deps.storage.getSubscriber(email);

  if (existing?.status === "confirmed") {
    return json(200, { ok: true });
  }

  const confirmToken = generateToken();
  const unsubscribeToken = existing?.unsubscribeToken ?? generateToken();

  const next: Subscriber = {
    email,
    status: "pending",
    createdAt: existing?.createdAt ?? now,
    confirmedAt: null,
    unsubscribedAt: null,
    confirmToken,
    unsubscribeToken,
  };
  await deps.storage.putSubscriber(next);

  await deps.email.sendConfirmation({
    to: email,
    confirmUrl: `${deps.siteUrl}/api/confirm?token=${confirmToken}`,
  });

  return json(200, { ok: true });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- handlers/subscribe`
Expected: all 8 tests pass.

- [ ] **Step 5: Create the Netlify function wrapper**

```ts
// netlify/functions/subscribe.ts
import { handleSubscribe } from "../lib/handlers/subscribe.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seancampbell.dev";

export default async (req: Request) =>
  handleSubscribe(req, {
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add netlify/lib/handlers/subscribe.ts netlify/lib/__tests__/handlers/subscribe.test.ts netlify/functions/subscribe.ts
git commit -m "feat(newsletter): add subscribe endpoint"
```

---

## Task 11: Confirm handler + function wrapper (TDD)

**Files:**
- Create: `netlify/lib/handlers/confirm.ts`
- Create: `netlify/lib/__tests__/handlers/confirm.test.ts`
- Create: `netlify/functions/confirm.ts`

- [ ] **Step 1: Write failing handler tests**

```ts
// netlify/lib/__tests__/handlers/confirm.test.ts
import { describe, it, expect } from "vitest";
import { handleConfirm } from "../../handlers/confirm.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps } from "../../types.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

function deps(): Deps {
  return {
    storage: memoryStorage(),
    email: fakeEmail(),
    clock: () => fixedNow,
    siteUrl: "https://seancampbell.dev",
  };
}

const tokenReq = (token: string) =>
  new Request(`https://seancampbell.dev/api/confirm?token=${token}`);

describe("handleConfirm", () => {
  it("redirects to /newsletter/error on missing token", async () => {
    const res = await handleConfirm(new Request("https://seancampbell.dev/api/confirm"), deps());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/error");
  });

  it("redirects to /newsletter/error on unknown token", async () => {
    const res = await handleConfirm(tokenReq("nope"), deps());
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/error");
  });

  it("flips a pending subscriber to confirmed and clears the token", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "pending",
      createdAt: fixedNow.toISOString(),
      confirmedAt: null,
      unsubscribedAt: null,
      confirmToken: "c".repeat(64),
      unsubscribeToken: "u".repeat(64),
    });
    const res = await handleConfirm(tokenReq("c".repeat(64)), d);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/confirmed");

    const sub = await d.storage.getSubscriber("sean@example.com");
    expect(sub!.status).toBe("confirmed");
    expect(sub!.confirmedAt).toBe(fixedNow.toISOString());
    expect(sub!.confirmToken).toBeNull();
  });

  it("is idempotent on a second click — confirmed user with a stale link redirects to error", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "confirmed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: fixedNow.toISOString(),
      unsubscribedAt: null,
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
    const res = await handleConfirm(tokenReq("c".repeat(64)), d);
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/error");
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npm test -- handlers/confirm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `handlers/confirm.ts`**

```ts
// netlify/lib/handlers/confirm.ts
import type { Deps } from "../types.js";

const redirect = (url: string) =>
  new Response(null, { status: 302, headers: { location: url } });

export async function handleConfirm(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return redirect(`${deps.siteUrl}/newsletter/error`);

  const sub = await deps.storage.findSubscriberByConfirmToken(token);
  if (!sub) return redirect(`${deps.siteUrl}/newsletter/error`);

  await deps.storage.putSubscriber({
    ...sub,
    status: "confirmed",
    confirmedAt: deps.clock().toISOString(),
    confirmToken: null,
  });

  return redirect(`${deps.siteUrl}/newsletter/confirmed`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- handlers/confirm`
Expected: all 4 tests pass.

- [ ] **Step 5: Create the function wrapper**

```ts
// netlify/functions/confirm.ts
import { handleConfirm } from "../lib/handlers/confirm.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seancampbell.dev";

export default async (req: Request) =>
  handleConfirm(req, {
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });
```

- [ ] **Step 6: Commit**

```bash
git add netlify/lib/handlers/confirm.ts netlify/lib/__tests__/handlers/confirm.test.ts netlify/functions/confirm.ts
git commit -m "feat(newsletter): add confirm endpoint"
```

---

## Task 12: Unsubscribe handler + function wrapper + round-trip test (TDD)

**Files:**
- Create: `netlify/lib/handlers/unsubscribe.ts`
- Create: `netlify/lib/__tests__/handlers/unsubscribe.test.ts`
- Create: `netlify/lib/__tests__/handlers/roundtrip.test.ts`
- Create: `netlify/functions/unsubscribe.ts`

- [ ] **Step 1: Write failing unsubscribe tests**

```ts
// netlify/lib/__tests__/handlers/unsubscribe.test.ts
import { describe, it, expect } from "vitest";
import { handleUnsubscribe } from "../../handlers/unsubscribe.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps } from "../../types.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

function deps(): Deps {
  return {
    storage: memoryStorage(),
    email: fakeEmail(),
    clock: () => fixedNow,
    siteUrl: "https://seancampbell.dev",
  };
}

const tokenReq = (token: string) =>
  new Request(`https://seancampbell.dev/api/unsubscribe?token=${token}`);

describe("handleUnsubscribe", () => {
  it("redirects to /newsletter/error on missing token", async () => {
    const res = await handleUnsubscribe(new Request("https://seancampbell.dev/api/unsubscribe"), deps());
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/error");
  });

  it("redirects to /newsletter/error on unknown token", async () => {
    const res = await handleUnsubscribe(tokenReq("nope"), deps());
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/error");
  });

  it("flips confirmed → unsubscribed and redirects", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "confirmed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: fixedNow.toISOString(),
      unsubscribedAt: null,
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
    const res = await handleUnsubscribe(tokenReq("u".repeat(64)), d);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/unsubscribed");

    const sub = await d.storage.getSubscriber("sean@example.com");
    expect(sub!.status).toBe("unsubscribed");
    expect(sub!.unsubscribedAt).toBe(fixedNow.toISOString());
  });

  it("is idempotent on a second click", async () => {
    const d = deps();
    await d.storage.putSubscriber({
      email: "sean@example.com",
      status: "unsubscribed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: fixedNow.toISOString(),
      unsubscribedAt: fixedNow.toISOString(),
      confirmToken: null,
      unsubscribeToken: "u".repeat(64),
    });
    const res = await handleUnsubscribe(tokenReq("u".repeat(64)), d);
    expect(res.headers.get("location")).toBe("https://seancampbell.dev/newsletter/unsubscribed");
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- handlers/unsubscribe`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `handlers/unsubscribe.ts`**

```ts
// netlify/lib/handlers/unsubscribe.ts
import type { Deps } from "../types.js";

const redirect = (url: string) =>
  new Response(null, { status: 302, headers: { location: url } });

export async function handleUnsubscribe(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return redirect(`${deps.siteUrl}/newsletter/error`);

  const sub = await deps.storage.findSubscriberByUnsubscribeToken(token);
  if (!sub) return redirect(`${deps.siteUrl}/newsletter/error`);

  if (sub.status !== "unsubscribed") {
    await deps.storage.putSubscriber({
      ...sub,
      status: "unsubscribed",
      unsubscribedAt: deps.clock().toISOString(),
    });
  }

  return redirect(`${deps.siteUrl}/newsletter/unsubscribed`);
}
```

- [ ] **Step 4: Run unsubscribe tests**

Run: `npm test -- handlers/unsubscribe`
Expected: all 4 tests pass.

- [ ] **Step 5: Write the round-trip integration test**

```ts
// netlify/lib/__tests__/handlers/roundtrip.test.ts
import { describe, it, expect } from "vitest";
import { handleSubscribe } from "../../handlers/subscribe.js";
import { handleConfirm } from "../../handlers/confirm.js";
import { handleUnsubscribe } from "../../handlers/unsubscribe.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps } from "../../types.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

describe("subscribe → confirm → unsubscribe round trip", () => {
  it("walks a user through the full lifecycle", async () => {
    const deps: Deps = {
      storage: memoryStorage(),
      email: fakeEmail(),
      clock: () => fixedNow,
      siteUrl: "https://seancampbell.dev",
    };

    const subRes = await handleSubscribe(
      new Request("https://seancampbell.dev/api/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nf-client-connection-ip": "1.1.1.1",
        },
        body: JSON.stringify({ email: "sean@example.com" }),
      }),
      deps,
    );
    expect(subRes.status).toBe(200);

    const sent = (deps.email as any).sent;
    expect(sent).toHaveLength(1);
    const confirmUrl: string = sent[0].confirmUrl;

    const confirmRes = await handleConfirm(new Request(confirmUrl), deps);
    expect(confirmRes.headers.get("location")).toBe(
      "https://seancampbell.dev/newsletter/confirmed",
    );

    const sub = await deps.storage.getSubscriber("sean@example.com");
    expect(sub!.status).toBe("confirmed");

    const unsubUrl = `https://seancampbell.dev/api/unsubscribe?token=${sub!.unsubscribeToken}`;
    const unsubRes = await handleUnsubscribe(new Request(unsubUrl), deps);
    expect(unsubRes.headers.get("location")).toBe(
      "https://seancampbell.dev/newsletter/unsubscribed",
    );

    const final = await deps.storage.getSubscriber("sean@example.com");
    expect(final!.status).toBe("unsubscribed");
  });
});
```

- [ ] **Step 6: Run round-trip test**

Run: `npm test -- roundtrip`
Expected: passes.

- [ ] **Step 7: Create the function wrapper**

```ts
// netlify/functions/unsubscribe.ts
import { handleUnsubscribe } from "../lib/handlers/unsubscribe.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seancampbell.dev";

export default async (req: Request) =>
  handleUnsubscribe(req, {
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });
```

- [ ] **Step 8: Commit**

```bash
git add netlify/lib/handlers/unsubscribe.ts netlify/lib/__tests__/handlers/unsubscribe.test.ts netlify/lib/__tests__/handlers/roundtrip.test.ts netlify/functions/unsubscribe.ts
git commit -m "feat(newsletter): add unsubscribe endpoint and round-trip test"
```

---

## Task 13: Send-newsletter scheduled handler + function wrapper (TDD)

**Files:**
- Create: `netlify/lib/handlers/send-newsletter.ts`
- Create: `netlify/lib/__tests__/handlers/send-newsletter.test.ts`
- Create: `netlify/functions/send-newsletter.ts`

The handler needs an injected RSS-fetching function for testability — extend `Deps` with an optional `fetchItems` override, defaulting to `fetchRss` in production.

- [ ] **Step 1: Extend `Deps` type**

In `netlify/lib/types.ts`, add to the `Deps` type:

```ts
import type { RssItem } from "./rss.js";

// ...existing properties...
fetchItems?: (siteUrl: string) => Promise<RssItem[]>;
```

Updated `Deps`:

```ts
export type Deps = {
  storage: Storage;
  email: EmailSender;
  clock: Clock;
  siteUrl: string;
  fetchItems?: (siteUrl: string) => Promise<import("./rss.js").RssItem[]>;
};
```

- [ ] **Step 2: Write failing handler tests**

```ts
// netlify/lib/__tests__/handlers/send-newsletter.test.ts
import { describe, it, expect } from "vitest";
import { handleSendNewsletter } from "../../handlers/send-newsletter.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps, Subscriber } from "../../types.js";
import type { RssItem } from "../../rss.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

function rss(...items: Array<[string, string, string]>): RssItem[] {
  return items.map(([title, slug, pubDate]) => ({
    title,
    description: `${title} desc`,
    link: `https://seancampbell.dev/blog/${slug}/`,
    pubDate,
  }));
}

function confirmedSub(email: string, unsubscribeToken: string): Subscriber {
  return {
    email,
    status: "confirmed",
    createdAt: fixedNow.toISOString(),
    confirmedAt: fixedNow.toISOString(),
    unsubscribedAt: null,
    confirmToken: null,
    unsubscribeToken,
  };
}

function deps(items: RssItem[], overrides: Partial<Deps> = {}): Deps {
  return {
    storage: memoryStorage(),
    email: fakeEmail(),
    clock: () => fixedNow,
    siteUrl: "https://seancampbell.dev",
    fetchItems: async () => items,
    ...overrides,
  };
}

describe("handleSendNewsletter", () => {
  it("bootstraps state without sending on first run", async () => {
    const items = rss(
      ["A", "a", "2026-01-01T00:00:00.000Z"],
      ["B", "b", "2026-02-01T00:00:00.000Z"],
    );
    const d = deps(items);
    await d.storage.putSubscriber(confirmedSub("sean@example.com", "u".repeat(64)));

    await handleSendNewsletter(d);

    const state = await d.storage.getState();
    expect(state!.lastSentPubDate).toBe("2026-02-01T00:00:00.000Z");
    expect((d.email as any).sent).toHaveLength(0);
  });

  it("sends each new post to all confirmed subscribers in chronological order", async () => {
    const items = rss(
      ["A", "a", "2026-01-01T00:00:00.000Z"],
      ["B", "b", "2026-02-01T00:00:00.000Z"],
      ["C", "c", "2026-03-01T00:00:00.000Z"],
    );
    const d = deps(items);
    await d.storage.putState({
      lastSentPubDate: "2026-01-15T00:00:00.000Z",
      sendingLockUntil: null,
    });
    await d.storage.putSubscriber(confirmedSub("a@example.com", "u1".padEnd(64, "0")));
    await d.storage.putSubscriber(confirmedSub("b@example.com", "u2".padEnd(64, "0")));

    await handleSendNewsletter(d);

    const sent = (d.email as any).sent;
    expect(sent).toHaveLength(4);
    expect(sent.map((e: any) => e.postTitle)).toEqual(["B", "B", "C", "C"]);
    const state = await d.storage.getState();
    expect(state!.lastSentPubDate).toBe("2026-03-01T00:00:00.000Z");
  });

  it("skips pending and unsubscribed subscribers", async () => {
    const items = rss(["A", "a", "2026-02-01T00:00:00.000Z"]);
    const d = deps(items);
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: null,
    });
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u".repeat(64)));
    await d.storage.putSubscriber({
      email: "p@example.com",
      status: "pending",
      createdAt: fixedNow.toISOString(),
      confirmedAt: null,
      unsubscribedAt: null,
      confirmToken: "c".repeat(64),
      unsubscribeToken: "u2".padEnd(64, "0"),
    });
    await d.storage.putSubscriber({
      email: "x@example.com",
      status: "unsubscribed",
      createdAt: fixedNow.toISOString(),
      confirmedAt: fixedNow.toISOString(),
      unsubscribedAt: fixedNow.toISOString(),
      confirmToken: null,
      unsubscribeToken: "u3".padEnd(64, "0"),
    });

    await handleSendNewsletter(d);

    const sent = (d.email as any).sent;
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ok@example.com");
    expect(sent[0].unsubscribeUrl).toContain(`token=${"u".repeat(64)}`);
  });

  it("aborts when a send lock is in the future", async () => {
    const items = rss(["A", "a", "2026-02-01T00:00:00.000Z"]);
    const d = deps(items);
    const future = new Date(fixedNow.getTime() + 5 * 60 * 1000).toISOString();
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: future,
    });
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u".repeat(64)));

    await handleSendNewsletter(d);

    expect((d.email as any).sent).toHaveLength(0);
  });

  it("ignores a stale lock", async () => {
    const items = rss(["A", "a", "2026-02-01T00:00:00.000Z"]);
    const d = deps(items);
    const stale = new Date(fixedNow.getTime() - 60 * 1000).toISOString();
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: stale,
    });
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u".repeat(64)));

    await handleSendNewsletter(d);

    expect((d.email as any).sent).toHaveLength(1);
  });

  it("clears the lock after a successful send", async () => {
    const items = rss(["A", "a", "2026-02-01T00:00:00.000Z"]);
    const d = deps(items);
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: null,
    });
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u".repeat(64)));

    await handleSendNewsletter(d);

    const state = await d.storage.getState();
    expect(state!.sendingLockUntil).toBeNull();
  });

  it("continues despite per-recipient send failures", async () => {
    const items = rss(["A", "a", "2026-02-01T00:00:00.000Z"]);
    const failing = {
      sent: [] as any[],
      async sendConfirmation() {},
      async sendPostNotification(args: any) {
        if (args.to === "bad@example.com") throw new Error("bounce");
        this.sent.push(args);
      },
    };
    const d = deps(items, { email: failing as any });
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: null,
    });
    await d.storage.putSubscriber(confirmedSub("bad@example.com", "u1".padEnd(64, "0")));
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u2".padEnd(64, "0")));

    await handleSendNewsletter(d);

    expect(failing.sent).toHaveLength(1);
    expect(failing.sent[0].to).toBe("ok@example.com");
    const state = await d.storage.getState();
    expect(state!.lastSentPubDate).toBe("2026-02-01T00:00:00.000Z");
  });

  it("does nothing when there are no new items", async () => {
    const items = rss(["A", "a", "2026-01-01T00:00:00.000Z"]);
    const d = deps(items);
    await d.storage.putState({
      lastSentPubDate: "2026-01-01T00:00:00.000Z",
      sendingLockUntil: null,
    });
    await d.storage.putSubscriber(confirmedSub("ok@example.com", "u".repeat(64)));

    await handleSendNewsletter(d);

    expect((d.email as any).sent).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests — verify failure**

Run: `npm test -- handlers/send-newsletter`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `handlers/send-newsletter.ts`**

```ts
// netlify/lib/handlers/send-newsletter.ts
import type { Deps, State, Subscriber } from "../types.js";
import { fetchRss, diffNewItems, type RssItem } from "../rss.js";

const LOCK_DURATION_MS = 10 * 60 * 1000;

function slugFromLink(link: string, siteUrl: string): string {
  const path = link.replace(siteUrl, "").replace(/^\/+|\/+$/g, "");
  return path.replace(/^blog\//, "");
}

export async function handleSendNewsletter(deps: Deps): Promise<void> {
  const now = deps.clock();
  const fetchFn = deps.fetchItems ?? fetchRss;

  const state = await deps.storage.getState();

  if (state?.sendingLockUntil && new Date(state.sendingLockUntil).getTime() > now.getTime()) {
    return;
  }

  const items = await fetchFn(deps.siteUrl);
  if (items.length === 0) return;

  if (!state) {
    const newest = items
      .map((i) => new Date(i.pubDate).getTime())
      .reduce((a, b) => Math.max(a, b), -Infinity);
    await deps.storage.putState({
      lastSentPubDate: new Date(newest).toISOString(),
      sendingLockUntil: null,
    });
    return;
  }

  const newItems = diffNewItems(items, state.lastSentPubDate);
  if (newItems.length === 0) return;

  // Acquire lock
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
  await deps.storage.putState({ ...state, sendingLockUntil: lockUntil });

  const subs = (await deps.storage.listSubscribers()).filter(
    (s) => s.status === "confirmed",
  );

  let cursor: State = { ...state, sendingLockUntil: lockUntil };

  for (const item of newItems) {
    for (const sub of subs) {
      try {
        await deps.email.sendPostNotification({
          to: sub.email,
          postTitle: item.title,
          postDescription: item.description,
          postUrl: item.link,
          unsubscribeUrl: `${deps.siteUrl}/api/unsubscribe?token=${sub.unsubscribeToken}`,
        });
      } catch (err) {
        console.error(
          `[newsletter] send failed for ${sub.email} on "${item.title}":`,
          err,
        );
      }
    }
    cursor = { ...cursor, lastSentPubDate: item.pubDate };
    await deps.storage.putState(cursor);
  }

  // Release lock
  await deps.storage.putState({ ...cursor, sendingLockUntil: null });
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- handlers/send-newsletter`
Expected: all 8 tests pass.

- [ ] **Step 6: Create the scheduled function wrapper**

```ts
// netlify/functions/send-newsletter.ts
import type { Config } from "@netlify/functions";
import { handleSendNewsletter } from "../lib/handlers/send-newsletter.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seancampbell.dev";

export default async () => {
  await handleSendNewsletter({
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });
  return new Response("ok");
};

export const config: Config = {
  schedule: "*/15 * * * *",
};
```

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: every test in the suite passes.

- [ ] **Step 8: Commit**

```bash
git add netlify/lib/handlers/send-newsletter.ts netlify/lib/__tests__/handlers/send-newsletter.test.ts netlify/lib/types.ts netlify/functions/send-newsletter.ts
git commit -m "feat(newsletter): add scheduled send-newsletter job"
```

---

## Task 14: Newsletter Astro component

**Files:**
- Create: `src/components/Newsletter.astro`

- [ ] **Step 1: Implement `Newsletter.astro`**

```astro
---
interface Props {
  heading?: string;
  blurb?: string;
}

const {
  heading = "Subscribe to the blog",
  blurb = "New posts about software engineering, architecture, and lessons from production. No spam, unsubscribe anytime.",
} = Astro.props;
---

<section class="newsletter" aria-labelledby="newsletter-heading">
  <h3 id="newsletter-heading" class="newsletter-heading">{heading}</h3>
  <p class="newsletter-blurb">{blurb}</p>
  <form class="newsletter-form" data-newsletter-form novalidate>
    <input
      type="email"
      name="email"
      placeholder="you@domain.com"
      required
      autocomplete="email"
      class="newsletter-input"
      aria-label="Email address"
    />
    <button type="submit" class="newsletter-button">
      <span class="newsletter-button-label">Subscribe</span>
    </button>
  </form>
  <p class="newsletter-message" data-newsletter-message aria-live="polite"></p>
</section>

<script>
  const form = document.querySelector<HTMLFormElement>("[data-newsletter-form]");
  const message = document.querySelector<HTMLParagraphElement>("[data-newsletter-message]");
  if (form && message) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = form.querySelector<HTMLButtonElement>("button");
      const input = form.querySelector<HTMLInputElement>("input[name=email]");
      if (!input || !button) return;
      const email = input.value.trim();
      if (!email) {
        message.textContent = "Please enter an email address.";
        message.dataset.state = "error";
        return;
      }
      button.disabled = true;
      message.textContent = "";
      message.dataset.state = "";
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          form.reset();
          message.textContent = "Check your inbox for a confirmation email.";
          message.dataset.state = "success";
        } else if (res.status === 429) {
          message.textContent = "Too many attempts. Please try again in a few minutes.";
          message.dataset.state = "error";
        } else {
          message.textContent = "That didn't look right — please check the email address.";
          message.dataset.state = "error";
        }
      } catch {
        message.textContent = "Network error. Please try again.";
        message.dataset.state = "error";
      } finally {
        button.disabled = false;
      }
    });
  }
</script>

<style>
  .newsletter {
    max-width: var(--content-width);
    margin: var(--space-2xl) auto;
    padding: var(--space-2xl);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
  }

  .newsletter-heading {
    font-size: 22px;
    margin-bottom: var(--space-sm);
    color: var(--color-text-primary);
  }

  .newsletter-blurb {
    font-size: 15px;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-lg);
    line-height: 1.6;
  }

  .newsletter-form {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .newsletter-input {
    flex: 1 1 240px;
    padding: 12px 16px;
    font-size: 15px;
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--transition-base);
  }

  .newsletter-input:focus {
    border-color: var(--color-accent);
  }

  .newsletter-button {
    padding: 12px 22px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-base), transform var(--transition-base);
  }

  .newsletter-button:hover:not(:disabled) {
    background: #7ab8fc;
    transform: translateY(-2px);
  }

  .newsletter-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .newsletter-message {
    margin-top: var(--space-md);
    font-size: 14px;
    color: var(--color-text-muted);
    min-height: 1.4em;
  }

  .newsletter-message[data-state="success"] {
    color: var(--color-accent);
  }

  .newsletter-message[data-state="error"] {
    color: #ff7676;
  }

  @media (max-width: 640px) {
    .newsletter {
      padding: var(--space-xl);
    }
    .newsletter-form {
      flex-direction: column;
    }
  }
</style>
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Newsletter.astro
git commit -m "feat(newsletter): add signup component"
```

---

## Task 15: Newsletter result pages

**Files:**
- Create: `src/pages/newsletter/confirmed.astro`
- Create: `src/pages/newsletter/unsubscribed.astro`
- Create: `src/pages/newsletter/error.astro`

- [ ] **Step 1: Create `confirmed.astro`**

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import Footer from "../../components/Footer.astro";
---

<Layout
  title="You're subscribed | Sean Campbell"
  description="Subscription confirmed."
>
  <Nav />
  <main class="newsletter-result">
    <h1>You're in.</h1>
    <p>
      Thanks for confirming. New blog posts will land in your inbox as soon as
      they go up.
    </p>
    <a href="/blog" class="back-link">← Back to the blog</a>
  </main>
  <Footer />
</Layout>

<style>
  .newsletter-result {
    max-width: 560px;
    margin: 0 auto;
    padding: 160px var(--space-xl) var(--space-4xl);
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .newsletter-result h1 {
    margin-bottom: var(--space-lg);
  }
  .newsletter-result p {
    font-size: 18px;
    color: var(--color-text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-2xl);
  }
  .back-link {
    color: var(--color-accent);
    font-weight: 600;
  }
  .back-link:hover {
    text-decoration: underline;
  }
</style>
```

- [ ] **Step 2: Create `unsubscribed.astro`**

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import Footer from "../../components/Footer.astro";
---

<Layout
  title="Unsubscribed | Sean Campbell"
  description="You've been unsubscribed."
>
  <Nav />
  <main class="newsletter-result">
    <h1>You're unsubscribed.</h1>
    <p>
      No more newsletter emails will be sent to you. If this was a mistake,
      you can resubscribe from the blog page anytime.
    </p>
    <a href="/blog" class="back-link">← Back to the blog</a>
  </main>
  <Footer />
</Layout>

<style>
  .newsletter-result {
    max-width: 560px;
    margin: 0 auto;
    padding: 160px var(--space-xl) var(--space-4xl);
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .newsletter-result h1 {
    margin-bottom: var(--space-lg);
  }
  .newsletter-result p {
    font-size: 18px;
    color: var(--color-text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-2xl);
  }
  .back-link {
    color: var(--color-accent);
    font-weight: 600;
  }
  .back-link:hover {
    text-decoration: underline;
  }
</style>
```

- [ ] **Step 3: Create `error.astro`**

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import Footer from "../../components/Footer.astro";
---

<Layout
  title="Link not valid | Sean Campbell"
  description="That link didn't work."
>
  <Nav />
  <main class="newsletter-result">
    <h1>That link didn't work.</h1>
    <p>
      The link is missing or invalid. If you were trying to confirm a
      subscription, head back to the blog and try signing up again.
    </p>
    <a href="/blog" class="back-link">← Back to the blog</a>
  </main>
  <Footer />
</Layout>

<style>
  .newsletter-result {
    max-width: 560px;
    margin: 0 auto;
    padding: 160px var(--space-xl) var(--space-4xl);
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .newsletter-result h1 {
    margin-bottom: var(--space-lg);
  }
  .newsletter-result p {
    font-size: 18px;
    color: var(--color-text-secondary);
    line-height: 1.7;
    margin-bottom: var(--space-2xl);
  }
  .back-link {
    color: var(--color-accent);
    font-weight: 600;
  }
  .back-link:hover {
    text-decoration: underline;
  }
</style>
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: build succeeds; `dist/newsletter/confirmed/index.html` etc. exist.

- [ ] **Step 5: Commit**

```bash
git add src/pages/newsletter/
git commit -m "feat(newsletter): add confirmed/unsubscribed/error pages"
```

---

## Task 16: Wire Newsletter into blog index

**Files:**
- Modify: `src/pages/blog/index.astro`

- [ ] **Step 1: Add Newsletter import to the frontmatter**

In `src/pages/blog/index.astro`, replace the existing import block with:

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import Footer from "../../components/Footer.astro";
import Newsletter from "../../components/Newsletter.astro";
import { getCollection } from "astro:content";

const posts = (
  await getCollection("blog", ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  })
).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---
```

- [ ] **Step 2: Replace the empty-state CTA**

Change the empty-state block from:

```astro
<a href="/#contact" class="subscribe-cta">
  Get notified when I publish →
</a>
```

to a Newsletter component:

```astro
<Newsletter />
```

Then delete these two now-unused CSS blocks from the `<style>` block:

```css
  .subscribe-cta {
    display: inline-block;
    padding: 12px 24px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: all var(--transition-base);
  }

  .subscribe-cta:hover {
    background: #7ab8fc;
    transform: translateY(-2px);
  }
```

- [ ] **Step 3: Add a Newsletter card above the posts grid**

When posts exist, render Newsletter above the grid. The body becomes:

```astro
{
  posts.length === 0 ? (
    <div class="empty-state">
      <p class="empty-text">
        Coming soon! I'm working on some posts about:
      </p>
      <ul class="upcoming-topics">
        <li>Composition vs Inheritance in Angular</li>
        <li>Containerizing .NET + Python Applications</li>
        <li>Lessons from Running a Creative Business as a Developer</li>
      </ul>
      <Newsletter />
    </div>
  ) : (
    <>
      <Newsletter />
      <div class="posts-grid">
        {posts.map((post) => (
          <article class="post-card">
            <a href={`/blog/${post.slug}`} class="post-link">
              {post.data.heroImage && (
                <img src={post.data.heroImage} alt="" class="post-image" />
              )}
              <div class="post-content">
                <time
                  datetime={post.data.pubDate.toISOString()}
                  class="post-date"
                >
                  {post.data.pubDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 class="post-title">{post.data.title}</h2>
                <p class="post-excerpt">{post.data.description}</p>
                {post.data.tags && (
                  <div class="post-tags">
                    {post.data.tags.map((tag: string) => (
                      <span class="post-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          </article>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run dev server and eyeball verify**

Run: `npm run dev`
Open: `http://localhost:4321/blog`
Expected: Newsletter card visible above the post grid; styled consistently with post cards; no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/blog/index.astro
git commit -m "feat(newsletter): add signup component to blog index"
```

---

## Task 17: Wire Newsletter into BlogPost layout

**Files:**
- Modify: `src/layouts/BlogPost.astro`

- [ ] **Step 1: Import Newsletter in the frontmatter**

In `src/layouts/BlogPost.astro`, add a single import line after the `Footer` import. Final frontmatter:

```astro
---
import Layout from './Layout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import Newsletter from '../components/Newsletter.astro';

interface Props {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  heroImage?: string;
  tags?: string[];
}

const { title, description, pubDate, updatedDate, heroImage, tags = [] } = Astro.props;

const formattedDate = pubDate.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const formattedUpdatedDate = updatedDate?.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
---
```

- [ ] **Step 2: Insert Newsletter at the bottom of the post content**

Find the existing `<aside class="post-footer">` block. Insert the Newsletter component **before** it, inside `<main>`:

```astro
<Newsletter
  heading="Like this? Subscribe."
  blurb="Get new posts in your inbox. No spam, unsubscribe anytime."
/>

<aside class="post-footer">
  <a href="/blog" class="back-link">← Back to all posts</a>
</aside>
```

- [ ] **Step 3: Verify with dev server**

Run: `npm run dev`
Open: `http://localhost:4321/blog/no-one-cares-about-your-work` (or whichever post exists).
Expected: Newsletter card visible after the article content, before the "Back to all posts" link.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BlogPost.astro
git commit -m "feat(newsletter): add signup component to blog post layout"
```

---

## Task 18: Footer change — Substack → /blog

**Files:**
- Modify: `src/components/Footer.astro`

- [ ] **Step 1: Remove the Substack entry from the social links array**

In `src/components/Footer.astro`, change `socialLinks`:

```ts
const socialLinks = [
  { href: 'https://github.com/seancampbell3161', icon: 'github' as const, label: 'GitHub' },
  { href: 'https://linkedin.com/in/seancampbelldev', icon: 'linkedin' as const, label: 'LinkedIn' },
  { href: 'mailto:sean@seanthedeveloper.com', icon: 'mail' as const, label: 'Email' },
];
```

(The `'substack'` entry is removed. Leave `Icon.astro` untouched — the substack icon stays in case it's needed later.)

- [ ] **Step 2: Build and view**

Run: `npm run dev`
Open: `http://localhost:4321/`
Expected: footer shows three icons (GitHub, LinkedIn, Mail) with no Substack icon.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat(newsletter): remove Substack link from footer"
```

---

## Task 19: Go-live runbook

**Files:**
- Create: `docs/superpowers/runbooks/2026-04-25-newsletter-golive.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Newsletter Go-Live Runbook

Order matters. Don't skip the test broadcast step.

## 1. Verify the sending domain in Resend

1. Sign up at resend.com if you haven't already.
2. Domains → Add Domain → enter `seanthedeveloper.com`.
3. Resend will display SPF, DKIM, and (optionally) DMARC records to add.
4. In HostGator's DNS panel for `seanthedeveloper.com`, add the displayed records as TXT/CNAME entries. Do **not** change the existing MX records — Workspace handles inbound.
5. Back in Resend, click "Verify". Wait until status = Verified (DNS can take 5–60 min to propagate).

## 2. Create a Resend API key

1. Resend → API Keys → Create API Key.
2. Permissions: Sending access only (not full).
3. Copy the key (`re_…`).

## 3. Set Netlify environment variables

In the Netlify dashboard for the portfolio site → Site configuration → Environment variables, add:

- `RESEND_API_KEY` = the Resend key
- `RESEND_FROM` = `Sean Campbell <newsletter@seanthedeveloper.com>`
- `SITE_URL` = `https://seancampbell.dev`

## 4. Deploy

Push the merged branch. Verify the deploy completes without errors. Confirm in the Netlify Functions tab that `subscribe`, `confirm`, `unsubscribe`, and `send-newsletter` are listed.

## 5. Smoke test the signup flow

1. Open the production site, scroll to the Newsletter card on `/blog`.
2. Subscribe with a personal email you can check.
3. You should see "Check your inbox for a confirmation email."
4. Open the email. Verify the from address is `newsletter@seanthedeveloper.com` and that the confirmation button works.
5. Click confirm — you should land at `/newsletter/confirmed`.
6. Open Netlify CLI: `netlify blobs:list newsletter`. Confirm a `sub:<your-email>` record exists with `status: confirmed`.

## 6. Bootstrap the send state

The first scheduled run is no-op-by-design — it stamps `lastSentPubDate` to the newest existing post and exits without emailing anyone.

Trigger it manually instead of waiting up to 15 minutes:

```bash
netlify functions:invoke send-newsletter --no-identity
```

Then `netlify blobs:get newsletter __state` and confirm:

```json
{ "lastSentPubDate": "<newest existing post's pubDate>", "sendingLockUntil": null }
```

## 7. End-to-end test with a real new post

1. Publish a draft post (set `draft: false`, push).
2. Wait for Netlify to redeploy and `/rss.xml` to update.
3. Wait up to 15 minutes for the next cron run, OR run `netlify functions:invoke send-newsletter` manually.
4. Verify the email arrives at your subscribed address with the post title, description, "Read on the site →" CTA, and an unsubscribe link.
5. Click the unsubscribe link → you land on `/newsletter/unsubscribed`. Verify the Blob record now shows `status: unsubscribed`.

## 8. Deliverability check

In Gmail, open the post-notification email, then "Show original". Confirm:

- SPF: PASS
- DKIM: PASS
- DMARC: PASS (or `BESTGUESS` if no DMARC record was added)

If any fail, fix DNS before announcing the newsletter publicly.

## 9. Rollback

If the signup form has problems, the fastest mitigation is to remove the `<Newsletter />` import from `src/pages/blog/index.astro` and `src/layouts/BlogPost.astro` and redeploy. Functions and stored data remain intact for later debugging.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-04-25-newsletter-golive.md
git commit -m "docs(newsletter): add go-live runbook"
```

---

## Final verification

- [ ] **Step 1: Full test suite passes**

Run: `npm test`
Expected: every test passes.

- [ ] **Step 2: Production build clean**

Run: `npm run build`
Expected: build succeeds with no warnings about missing routes.

- [ ] **Step 3: Type-check clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual sanity in `npm run dev`**

Visit `/blog` and any post page. Confirm the Newsletter card renders and the form is interactive (form submit will fail without functions running locally — that's expected; the UI/JS path itself should not throw).
