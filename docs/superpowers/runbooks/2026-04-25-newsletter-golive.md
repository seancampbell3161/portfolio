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
- `SITE_URL` = `https://seanthedeveloper.com`

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
