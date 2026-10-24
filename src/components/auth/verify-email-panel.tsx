"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { FormNotice } from "@/components/auth/form-notice";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/validation/auth";

export function VerifyEmailPanel({ email }: { email?: string }) {
  const t = useTranslations("Auth");
  const [address, setAddress] = useState(email ?? "");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function resend() {
    setOk(null);
    setErr(null);

    const parsed = emailSchema.safeParse(address);
    if (!parsed.success) {
      setErr(t(`errors.${parsed.error.issues[0]?.message ?? "emailInvalid"}`));
      return;
    }

    setPending(true);
    const { error } = await authClient.sendVerificationEmail({
      email: parsed.data,
      callbackURL: new URL("/verify-email/complete", window.location.origin).toString(),
    });
    setPending(false);

    if (error) {
      setErr(error.status === 429 ? t("errors.tooManyRequests") : t("errors.generic"));
      return;
    }
    setOk(t("resent"));
    setCooldown(60); // the server enforces the real limit; this just discourages clicking
  }

  return   (
    <div className="space-y-6">
      <FormNotice message={ok} />
      <FormAlert message={err} />

      {!email && (
        <TextField 
          label={t("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      )}

      <Button
        type="button"
        onClick={resend}
        disabled={pending || cooldown > 0}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg:primary-hover"
      >
        {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">{t("verifySpamHint")}</p>
    </div>
  );
}