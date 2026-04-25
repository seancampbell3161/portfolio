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
