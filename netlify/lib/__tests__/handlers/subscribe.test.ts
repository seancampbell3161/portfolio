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
