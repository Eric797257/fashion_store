"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "facebook";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function SocialButtons({
  providers,
  next,
}: {
  providers: { google: boolean; facebook: boolean };
  next: string;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!providers.google && !providers.facebook) return null;

  async function start(provider: Provider) {
    setError(null);
    setPending(provider);

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next,
      newUserCallbackURL: next,
      errorCallbackURL: "/sign-in",
      additionalData: { locale }, // saved on new accounts (validated on the server)
    });

    // On success the browser is redirected to the provider, so we only handle failures here
    if (error) {
      setPending(null);
      setError(error.status === 429 ? t("errors.tooManyRequests") : t("errors.generic"));
    }
  }

  const items: { provider: Provider; label: string; logo: ReactNode }[] = [];
  if (providers.google)
    items.push({ provider: "google", label: t("continueWithGoogle"), logo: <GoogleLogo /> });
  if (providers.facebook)
    items.push({ provider: "facebook", label: t("continueWithFacebook"), logo: <FacebookLogo /> });

  return (
    <div className="mt-6 space-y-3">
      <FormAlert message={error} />
      {items.map(({ provider, label, logo }) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => start(provider)}
          className="h-11 w-full gap-3"
        >
          {logo}
          {label}
        </Button>
      ))}

      <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("orDivider")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}