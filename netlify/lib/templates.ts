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
