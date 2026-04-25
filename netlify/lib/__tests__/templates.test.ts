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
