import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/server/auth/session";
import Link from "next/link";

export const instant = false; // reads the session (request data)

export default async function AccountPage() {
  const [t, session] = await Promise.all([getTranslations("Auth"), requireUser("/account")]);
  const { user } = session;
  const role = (user as { role?: string | null }).role ?? "CUSTOMER";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold">{t("accountTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("signedInAs", { email: user.email })}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("role")}: <span className="font-medium text-foreground">{role}</span>
      </p>
      <p className="mt-6 text-sm text-muted-foreground">{t("accountNote")}</p>

      <p className="mt-6">
        <Link href="/account/security" className="text-primary hover:underline">
          {t("securityLink")}
        </Link>
      </p>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}