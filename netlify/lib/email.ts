import { Resend } from "resend";
import type { EmailSender } from "./types.js";
import { confirmationEmail, postNotificationEmail } from "./templates.js";

export function resendSender(args: {
  apiKey: string;
  from: string;
}): EmailSender {
  const client = new Resend(args.apiKey);

  return {
    async sendConfirmation({ to, confirmUrl }) {
      const e = confirmationEmail({ confirmUrl });
      const { error } = await client.emails.send({
        from: args.from,
        to,
        subject: e.subject,
        html: e.html,
        text: e.text,
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
    },
    async sendPostNotification({ to, postTitle, postDescription, postUrl, unsubscribeUrl }) {
      const e = postNotificationEmail({ postTitle, postDescription, postUrl, unsubscribeUrl });
      const { error } = await client.emails.send({
        from: args.from,
        to,
        subject: e.subject,
        html: e.html,
        text: e.text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
    },
  };
}
