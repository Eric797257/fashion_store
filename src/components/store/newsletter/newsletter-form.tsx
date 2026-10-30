"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletter, type SubscribeState } from "@/server/newsletter/actions";

const MESSAGE_KEY = {
  sent: "sent",
  invalid: "invalid",
  rate_limited: "rateLimited",
  error: "error",
} as const;

export function NewsletterForm() {
  const t = useTranslations("Newsletter");
  const [state, formAction, pending] = useActionState<SubscribeState, FormData>(subscribeNewsletter, {
    status: "idle",
  });

  return (
    <form action={formAction} noValidate className="space-y-3 text-left">
      {/* Honeypot: invisible to people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label htmlFor="newsletter-email" className="sr-only">
        {t("emailLabel")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("placeholder")}
          className="h-12 flex-1"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-12 bg-primary px-8 text-primary-foreground hover:bg-primary-hover"
        >
          {pending ? t("subscribing") : t("subscribe")}
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${state.status === "sent" ? "text-success" : "text-destructive"}`}
      >
        {state.status !== "idle" ? t(MESSAGE_KEY[state.status]) : ""}
      </p>
    </form>
  );
}