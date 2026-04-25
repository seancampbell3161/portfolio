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
