"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  confirmNewsletter,
  unsubscribeNewsletter,
  type TokenActionState,
} from "@/server/newsletter/actions";

export function NewsletterTokenForm({
  mode,
  token,
}: {
  mode: "confirm" | "unsubscribe";
  token: string;
}) {
  const t = useTranslations("Newsletter");
  const action = mode === "confirm" ? confirmNewsletter : unsubscribeNewsletter;
  const [state, formAction, pending] = useActionState<TokenActionState, FormData>(action, {
    status: "idle",
  });

  const resultText: Record<string, string> = {
    done: mode === "confirm" ? t("confirmed") : t("unsubscribed"),
    already: t("already"),
    invalid: t("invalidLink"),
    rate_limited: t("rateLimited"),
    error: t("error"),
  };

  if (state.status === "done" || state.status === "already") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-success">{resultText[state.status]}</p>
        <Link href="/" className="text-primary hover:underline">
          {t("backHome")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.status !== "idle" && (
        <p role="alert" className="text-sm text-destructive">
          {resultText[state.status]}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-12 bg-primary px-8 text-primary-foreground hover:bg-primary-hover"
      >
        {mode === "confirm" ? t("confirmButton") : t("unsubscribeButton")}
      </Button>
    </form>
  );
}