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
    siteUrl: "https://seanthedeveloper.com",
  };
}

const tokenReq = (token: string) =>
  new Request(`https://seanthedeveloper.com/api/unsubscribe?token=${token}`);

describe("handleUnsubscribe", () => {
  it("redirects to /newsletter/error on missing token", async () => {
    const res = await handleUnsubscribe(new Request("https://seanthedeveloper.com/api/unsubscribe"), deps());
    expect(res.headers.get("location")).toBe("https://seanthedeveloper.com/newsletter/error");
  });

  it("redirects to /newsletter/error on unknown token", async () => {
    const res = await handleUnsubscribe(tokenReq("nope"), deps());
    expect(res.headers.get("location")).toBe("https://seanthedeveloper.com/newsletter/error");
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
    expect(res.headers.get("location")).toBe("https://seanthedeveloper.com/newsletter/unsubscribed");

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
    expect(res.headers.get("location")).toBe("https://seanthedeveloper.com/newsletter/unsubscribed");
  });
});
