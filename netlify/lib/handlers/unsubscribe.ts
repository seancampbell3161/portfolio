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
