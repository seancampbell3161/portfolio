import type { Deps, State } from "../types.js";
import { fetchRss, diffNewItems } from "../rss.js";

const LOCK_DURATION_MS = 10 * 60 * 1000;

export async function handleSendNewsletter(deps: Deps): Promise<void> {
  try {
    await runBroadcast(deps);
  } catch (err) {
    console.error("[newsletter] scheduled run failed:", err);
  }
}

async function runBroadcast(deps: Deps): Promise<void> {
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

  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
  await deps.storage.putState({ ...state, sendingLockUntil: lockUntil });

  let cursor: State = { ...state, sendingLockUntil: lockUntil };

  try {
    const subs = (await deps.storage.listSubscribers()).filter(
      (s) => s.status === "confirmed",
    );

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
  } finally {
    await deps.storage.putState({ ...cursor, sendingLockUntil: null });
  }
}
