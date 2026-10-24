import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { isPrivilegedRole } from "@/server/permissions/catalog";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor");
  return { title: t("securityTitle"), robots: { index: false } };
}

export default async function SecurityPage() {
  const { user } = await requireUser("/account/security");
  const t = await getTranslations("TwoFactor");

  // Two-step verification protects password sign-in, so it needs a password account
  const accounts = await db.account.findMany({
    where: { userId: user.id },
    select: { providerId: true },
  });
  const hasPassword = accounts.some((a) => a.providerId === "credential");

  const enabled = Boolean((user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled);
  const role = (user as { role?: string | null }).role;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold">{t("securityTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("securitySubtitle")}</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-soft">
        {hasPassword ? (
          // canDisable only hides the button. Real enforcement for staff comes in Step 2.5.
          <TwoFactorSettings enabled={enabled} canDisable={!isPrivilegedRole(role)} />
        ) : (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t("noPasswordTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("noPasswordBody")}</p>
          </div>
        )}
      </div>
    </div>
  );
}