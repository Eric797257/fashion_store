"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "facebook";

export function ConnectedAccounts({
  accounts,
  providers,
  allowSocial,
}: {
  accounts: { id: string; providerId: string }[];
  providers: { google: boolean; facebook: boolean };
  allowSocial: boolean;
}) {
  const t = useTranslations("Security");
  const ta = useTranslations("Auth");
  const router = useRouter();
  const [pending, setPending] = useState<Provider | null>(null);
  const [confirming, setConfirming] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linked = (providerId: string) => accounts.some((a) => a.providerId === providerId);
  const methodCount = accounts.length;

  const available: Provider[] = [];
  if (providers.google) available.push("google");
  if (providers.facebook) available.push("facebook");

  const label = (p: Provider) => (p === "google" ? t("methodGoogle") : t("methodFacebook"));

  async function connect(provider: Provider) {
    setError(null);
    setPending(provider);
    const { error: err } = await authClient.linkSocial({
      provider,
      callbackURL: "/account/security",
    });
    // On success the browser is redirected to the provider
    if (err) {
      setPending(null);
      setError(err.status === 429 ? ta("errors.tooManyRequests") : ta("errors.generic"));
    }
  }

  async function disconnect(provider: Provider) {
    const row = accounts.find((a) => a.providerId === provider);
    if (!row) return;

    setError(null);
    setPending(provider);
    // This version of the API identifies the account by its row id
    const { error: err } = await authClient.unlinkAccount({ accountId: row.id });
    setPending(null);
    setConfirming(null);
    if (err) {
      setError(err.status === 400 ? t("lastMethod") : ta("errors.generic"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t("connectedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("connectedBody")}</p>
      </div>

      <FormAlert message={error} />

      <ul className="divide-y divide-border rounded-lg border border-border">
        {linked("credential") && (
          <li className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{t("methodCredential")}</span>
            <span className="text-muted-foreground">{t("connectedBadge")}</span>
          </li>
        )}

        {allowSocial &&
          available.map((provider) => {
            const isLinked = linked(provider);
            return (
              <li
                key={provider}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>{label(provider)}</span>

                {isLinked ? (
                  confirming === provider ? (
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {t("confirmDisconnect", { provider: label(provider) })}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => disconnect(provider)}
                      >
                        {t("yesDisconnect")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={ta("backToStore")}
                        onClick={() => setConfirming(null)}
                      >
                        ×
                      </Button>
                    </span>
                  ) : (
                    methodCount > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirming(provider)}
                      >
                        {t("disconnect")}
                      </Button>
                    )
                  )
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() => connect(provider)}
                  >
                    {t("connect")}
                  </Button>
                )}
              </li>
            );
          })}
      </ul>

      {!allowSocial && <p className="text-sm text-muted-foreground">{t("staffNoSocial")}</p>}
    </div>
  );
}