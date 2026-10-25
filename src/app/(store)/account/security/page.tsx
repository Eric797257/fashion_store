import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import { FormAlert } from "@/components/auth/form-alert";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { db } from "@/lib/db";
import { requireAccess } from "@/server/auth/access";
import { getEnabledProviders } from "@/server/auth/providers";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor");
  return { title: t("securityTitle"), robots: { index: false } };
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string | string[] }>;
}) {
  const access = await requireAccess("/account/security");
  const { required } = await searchParams;
  const t = await getTranslations("TwoFactor");

  const accounts = await db.account.findMany({
    where: { userId: access.userId },
    select: { id: true, providerId: true },
  });
  const hasPassword = accounts.some((a) => a.providerId === "credential");

  const mustEnable = access.isPrivileged && !access.twoFactorEnabled;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16 sm:px-6">
      <div>
        <h1 className="text-4xl font-semibold">{t("securityTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("securitySubtitle")}</p>
      </div>

      {mustEnable && required && <FormAlert message={t("requiredBanner")} />}

      <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
        {hasPassword ? (
          <TwoFactorSettings enabled={access.twoFactorEnabled} canDisable={!access.isPrivileged} />
        ) : (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t("noPasswordTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("noPasswordBody")}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <ConnectedAccounts
          accounts={accounts}
          providers={getEnabledProviders()}
          allowSocial={!access.isPrivileged}
        />
      </section>
    </div>
  );
}