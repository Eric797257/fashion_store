"use server";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/locale";
import { sendNewsletterConfirmation } from "@/integrations/email/auth-emails";
import { appUrl } from "@/integrations/email/templates";
import { allowRequest, clientIp } from "@/lib/memory-rate-limit";
import { emailSchema } from "@/validation/auth";
import { confirmByToken, requestSubscription, unsubscribeByToken } from "./service";

export type SubscribeState = {
  status: "idle" | "sent" | "invalid" | "rate_limited" | "error";
};
export type TokenActionState = {
  status: "idle" | "done" | "already" | "invalid" | "rate_limited" | "error";
};

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

export async function subscribeNewsletter(
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // Hidden field that only bots fill in: pretend it worked and do nothing
  if (String(formData.get("company") ?? "") !== "") return { status: "sent" };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "invalid" };

  const requestHeaders = await headers();
  if (!allowRequest(`newsletter:${clientIp(requestHeaders)}`, 5, 60 * 60 * 1000)) {
    return { status: "rate_limited" };
  }

  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  try {
    const { confirmToken } = await requestSubscription(parsed.data, locale);
    if (confirmToken) {
      // Not awaited on purpose (same as the account emails): the answer takes the same
      // time whether or not an email goes out. Failures are logged without the address.
      sendNewsletterConfirmation(
        { email: parsed.data, locale },
        `${appUrl()}/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`,
      );
    }
    // The same answer in every case, so the form can't reveal who is subscribed
    return { status: "sent" };
  } catch (error) {
    console.error("[newsletter] subscribe failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "error" };
  }
}

async function tokenAction(
  formData: FormData,
  limitKey: string,
  run: (token: string) => Promise<TokenActionState["status"]>,
): Promise<TokenActionState> {
  const token = String(formData.get("token") ?? "");
  if (!TOKEN.test(token)) return { status: "invalid" };

  if (!allowRequest(`${limitKey}:${clientIp(await headers())}`, 30, 60 * 60 * 1000)) {
    return { status: "rate_limited" };
  }

  try {
    return { status: await run(token) };
  } catch (error) {
    console.error(`[newsletter] ${limitKey} failed:`, error instanceof Error ? error.message : "unknown error");
    return { status: "error" };
  }
}

export async function confirmNewsletter(
  _previous: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  return tokenAction(formData, "newsletter-confirm", async (token) => {
    const result = await confirmByToken(token);
    return result === "CONFIRMED" ? "done" : result === "ALREADY" ? "already" : "invalid";
  });
}

export async function unsubscribeNewsletter(
  _previous: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  return tokenAction(formData, "newsletter-unsubscribe", async (token) =>
    (await unsubscribeByToken(token)) ? "done" : "invalid",
  );
}