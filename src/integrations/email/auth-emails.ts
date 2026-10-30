import { sendEmail } from "./index";
import { renderAuthEmail, renderCodeEmail, type AuthEmailKind, type EmailLocale } from "./templates";

export interface Recipient {
  email: string;
  name?: string | null;
  locale?: string | null;
}

function toLocale(value?: string | null): EmailLocale {
  return value === "my" ? "my" : "en";
}

function dispatch(kind: AuthEmailKind, to: Recipient, url: string) {
  const { subject, text, html } = renderAuthEmail({
    kind,
    locale: toLocale(to.locale),
    name: to.name?.trim() ?? "",
    url
  });

  // Deliberately NOT awaited: waiting would make the response time reveal whether
  // an account exists. Failures are logged WITHOUT the recipient, body or link.
  void sendEmail({ to: to.email, subject, text, html }).catch((err: unknown) => {
    console.error(
      `[email] failed to send "${kind}":`,
      err instanceof Error ? err.message : "unknown error",
    );
  });
}

export const sendVerificationLink = (to: Recipient, url: string) =>
  dispatch("verify-email", to, url);
export const sendPasswordResetLink = (to: Recipient, url: string) =>
  dispatch("reset-password", to, url);
export const sendPasswordChangedNotice = (to: Recipient, url: string) =>
  dispatch("password-changed", to, url);
export const sendExistingAccountNotice = (to: Recipient, url: string) =>
  dispatch("existing-account", to, url);
/**
 * Unlike the link emails, this one IS awaited: the person already proved their password,
 * so response time reveals nothing, and a delivery failure must show an error
 * instead of a fake "code sent".
 */
export async function sendTwoFactorCode(to: Recipient, code: string): Promise<void> {
  const { subject, text, html } = renderCodeEmail({
    locale: toLocale(to.locale),
    name: to.name?.trim() ?? "",
    code,
  });
  await sendEmail({ to: to.email, subject, text, html });
}

export const sendNewsletterConfirmation = (to: Recipient, url: string) =>
  dispatch("newsletter-confirm", to, url);