"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState, type FormEvent } from "react";
import { BackupCodes } from "@/components/auth/backup-codes";
import { FormAlert } from "@/components/auth/form-alert";
import { FormNotice } from "@/components/auth/form-notice";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { totpCodeSchema } from "@/validation/auth";

type View =
  | "home"
  | "enable-password"
  | "enable-scan"
  | "backup-codes"
  | "regen-password"
  | "disable-password";

const primaryButton = "bg-primary text-primary-foreground hover:bg-primary-hover";

/** Asks for the password, then runs `onSubmit`. Returns an error message or null on success. */
function PasswordStep({
  body,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  body: string;
  submitLabel: string;
  onSubmit: (password: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const t = useTranslations("TwoFactor");
  const ta = useTranslations("Auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError(ta("errors.passwordRequired"));
      return;
    }
    setPending(true);
    const message = await onSubmit(password);
    setPending(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={handle} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">{body}</p>
      <FormAlert message={error} />
      <TextField
        label={t("passwordLabel")}
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className={primaryButton}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** QR code, manual key, and the first code that proves the app is set up. */
function EnrollStep({
  totpURI,
  onVerified,
  onCancel,
}: {
  totpURI: string;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("TwoFactor");
  const ta = useTranslations("Auth");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  let secret = "";
  try {
    secret = new URL(totpURI).searchParams.get("secret") ?? "";
  } catch {
    secret = "";
  }
  const spaced = secret.match(/.{1,4}/g)?.join(" ") ?? secret;

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const code = value.trim();
    if (!totpCodeSchema.safeParse({ code }).success) {
      setError(t("errors.codeInvalid"));
      return;
    }
    setPending(true);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      const status = err.status ?? 0;
      setError(
        status === 429
          ? ta("errors.tooManyRequests")
          : status === 0 || status >= 500
            ? ta("errors.generic")
            : t("errors.wrongCode"),
      );
      return;
    }
    onVerified();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{t("scanTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("scanBody")}</p>

      <div
        role="img"
        aria-label={t("scanTitle")}
        className="inline-block rounded-lg border border-border bg-white p-3"
      >
        <QRCodeSVG value={totpURI} size={176} level="M" bgColor="#FFFFFF" fgColor="#20211F" />
      </div>

      {spaced && (
        <div className="text-sm">
          <p className="text-muted-foreground">{t("manualKey")}</p>
          <p className="mt-1 select-all break-all font-mono text-base">{spaced}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("secretWarn")}</p>
        </div>
      )}

      <form onSubmit={verify} noValidate className="space-y-4">
        <p className="text-sm">{t("enterCode")}</p>
        <FormAlert message={error} />
        <TextField
          label={t("codeLabel")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className={primaryButton}>
            {pending ? t("verifying") : t("confirm")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TwoFactorSettings({
  enabled,
  canDisable,
}: {
  enabled: boolean;
  canDisable: boolean;
}) {
  const t = useTranslations("TwoFactor");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Secrets and codes only live in memory while this screen needs them
  function reset() {
    setView("home");
    setTotpURI(null);
    setCodes([]);
  }

  const passwordError = (status?: number) =>
    status === 429
      ? ta("errors.tooManyRequests")
      : !status || status >= 500
        ? ta("errors.generic")
        : t("errors.wrongPassword");

  async function startEnable(password: string): Promise<string | null> {
    const { data, error } = await authClient.twoFactor.enable({ password });
    const result = data as { totpURI?: string; backupCodes?: string[] } | null;
    if (error) return passwordError(error.status);
    if (!result?.totpURI) return ta("errors.generic");
    setTotpURI(result.totpURI);
    setCodes(result.backupCodes ?? []);
    setNotice(null);
    setView("enable-scan");
    return null;
  }

  async function regenerate(password: string): Promise<string | null> {
    const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
    if (error) return passwordError(error.status);
    setCodes((data as { backupCodes?: string[] } | null)?.backupCodes ?? []);
    setNotice(null);
    setView("backup-codes");
    return null;
  }

  async function disable(password: string): Promise<string | null> {
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) return passwordError(error.status);
    reset();
    setNotice(t("disabled"));
    router.refresh();
    return null;
  }

  return (
    <div className="space-y-6">
      <FormNotice message={notice} />

      {view === "home" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={`size-2.5 rounded-full ${enabled ? "bg-success" : "bg-muted-foreground"}`}
            />
            {enabled ? t("statusOn") : t("statusOff")}
          </p>

          {!enabled && (
            <Button
              type="button"
              className={primaryButton}
              onClick={() => setView("enable-password")}
            >
              {t("enableButton")}
            </Button>
          )}

          {enabled && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setView("regen-password")}>
                {t("regenerate")}
              </Button>
              {canDisable && (
                <Button type="button" variant="outline" onClick={() => setView("disable-password")}>
                  {t("disableButton")}
                </Button>
              )}
            </div>
          )}

          {enabled && !canDisable && (
            <p className="text-sm text-muted-foreground">{t("staffRequired")}</p>
          )}
        </div>
      )}

      {view === "enable-password" && (
        <PasswordStep
          body={t("passwordPrompt")}
          submitLabel={t("continue")}
          onSubmit={startEnable}
          onCancel={reset}
        />
      )}

      {view === "enable-scan" && totpURI && (
        <EnrollStep totpURI={totpURI} onVerified={() => setView("backup-codes")} onCancel={reset} />
      )}

      {view === "backup-codes" && (
        <BackupCodes
          codes={codes}
          onDone={() => {
            reset();
            router.refresh();
          }}
        />
      )}

      {view === "regen-password" && (
        <PasswordStep
          body={t("regenerateBody")}
          submitLabel={t("regenerate")}
          onSubmit={regenerate}
          onCancel={reset}
        />
      )}

      {view === "disable-password" && (
        <PasswordStep
          body={t("disableBody")}
          submitLabel={t("disableButton")}
          onSubmit={disable}
          onCancel={reset}
        />
      )}
    </div>
  );
}