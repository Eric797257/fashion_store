"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { backupCodeSchema, totpCodeSchema } from "@/validation/auth";

type Mode = "totp" | "backup";

export function TwoFactorForm({
  next,
  showEmailOption,
}: {
  next: string;
  showEmailOption: boolean;
}) {
  const t = useTranslations("TwoFactor");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setValue("");
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const code = value.trim();
    const parsed =
      mode === "totp" ? totpCodeSchema.safeParse({ code }) : backupCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(t("errors.codeInvalid"));
      return;
    }

    setPending(true);
    const { error: err } =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code });
    setPending(false);

    if (err) {
      const status = err.status ?? 0;
      const codeName = String(err.code ?? "");
      setError(
        status === 429
          ? codeName.includes("LOCKED")
            ? t("errors.locked")
            : ta("errors.tooManyRequests")
          : codeName.includes("COOKIE")
            ? t("errors.sessionExpired")
            : status === 0 || status >= 500
              ? ta("errors.generic")
              : t("errors.wrongCode"),
      );
      return;
    }

    router.replace(next);
    router.refresh();
  }

  const linkButton = "text-sm text-primary hover:underline";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-semibold">{t("challengeTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "totp" ? t("challengeSubtitle") : t("backupSubtitle")}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <FormAlert message={error} />

        {mode === "totp" ? (
          <TextField
            label={t("codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          />
        ) : (
          <TextField
            label={t("backupLabel")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          {pending ? t("verifying") : t("verify")}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3">
        {mode === "totp" ? (
          <button type="button" className={linkButton} onClick={() => switchMode("backup")}>
            {t("useBackup")}
          </button>
        ) : (
          <button type="button" className={linkButton} onClick={() => switchMode("totp")}>
            {t("useAuthenticator")}
          </button>
        )}
        {showEmailOption && (
          <Link href={`/verify-otp?next=${encodeURIComponent(next)}`} className={linkButton}>
            {t("emailInstead")}
          </Link>
        )}
        <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-primary">
          {t("backToSignIn")}
        </Link>
      </div>
    </div>
  );
}