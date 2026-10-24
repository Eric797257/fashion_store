"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { FormNotice } from "@/components/auth/form-notice";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { totpCodeSchema } from "@/validation/auth";

export function TwoFactorOtpForm({ next }: { next: string }) {
  const t = useTranslations("TwoFactor");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send() {
    setError(null);
    setPending(true);
    const { error: err } = await authClient.twoFactor.sendOtp();
    setPending(false);

    if (err) {
      const status = err.status ?? 0;
      setError(
        err.message === "otpNotAllowed"
          ? t("errors.otpNotAllowed")
          : status === 429
            ? ta("errors.tooManyRequests")
            : codeNameIncludes(err.code, "COOKIE")
              ? t("errors.sessionExpired")
              : ta("errors.generic"),
      );
      return;
    }
    setSent(true);
    setCooldown(60);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const code = value.trim();
    if (!totpCodeSchema.safeParse({ code }).success) {
      setError(t("errors.codeInvalid"));
      return;
    }

    setPending(true);
    const { error: err } = await authClient.twoFactor.verifyOtp({ code });
    setPending(false);

    if (err) {
      const status = err.status ?? 0;
      setError(
        status === 429
          ? codeNameIncludes(err.code, "LOCKED")
            ? t("errors.locked")
            : ta("errors.tooManyRequests")
          : status === 0 || status >= 500
            ? ta("errors.generic")
            : t("errors.wrongCode"),
      );
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-semibold">{t("otpTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("otpSubtitle")}</p>

      <div className="mt-6 space-y-4">
        <FormAlert message={error} />
        {sent && <FormNotice message={t("codeSent")} />}

        {sent && (
          <form onSubmit={verify} noValidate className="space-y-4">
            <TextField
              label={t("otpLabel")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              type="submit"
              disabled={pending}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {pending ? t("verifying") : t("verify")}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant={sent ? "outline" : "default"}
          onClick={send}
          disabled={pending || cooldown > 0}
          className={
            sent
              ? "h-11 w-full"
              : "h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
          }
        >
          {cooldown > 0
            ? t("resendIn", { seconds: cooldown })
            : sent
              ? t("resendCode")
              : pending
                ? t("sending")
                : t("sendCode")}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link
          href={`/two-factor?next=${encodeURIComponent(next)}`}
          className="text-muted-foreground hover:text-primary"
        >
          ← {t("useAuthenticator")}
        </Link>
      </p>
    </div>
  );
}

function codeNameIncludes(code: unknown, part: string): boolean {
  return String(code ?? "").includes(part);
}