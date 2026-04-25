import type { Config } from "@netlify/functions";
import { handleSendNewsletter } from "../lib/handlers/send-newsletter.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seancampbell.dev";

export default async () => {
  await handleSendNewsletter({
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });
  return new Response("ok");
};

export const config: Config = {
  schedule: "*/15 * * * *",
};
