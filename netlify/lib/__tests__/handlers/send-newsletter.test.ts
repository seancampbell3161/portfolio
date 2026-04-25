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
