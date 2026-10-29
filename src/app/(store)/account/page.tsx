import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireAccess } from "@/server/auth/access";
import { hasPermission } from "@/server/permissions/policy";

export const instant = false;

export default async function AccountPage() {
  const [t, access] = await Promise.all([getTranslations("Auth"), requireAccess("/account")]);

  const linkClass = "text-primary hover:underline";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold">{t("accountTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("signedInAs", { email: access.email })}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("role")}: <span className="font-medium text-foreground">{access.role ?? "CUSTOMER"}</span>
      </p>
      <p className="mt-6 text-sm text-muted-foreground">{t("accountNote")}</p>

      <ul className="mt-6 space-y-2">
        <li>
          <Link href="/account/security" className={linkClass}>
            {t("securityLink")}
          </Link>
        </li>
        <li>
          <Link href="/account/wishlist" className={linkClass}>
            {t("wishlistLink")}
          </Link>
        </li>
        {hasPermission(access, "admin.access") && (
          <li>
            <Link href="/admin" className={linkClass}>
              {t("adminLink")}
            </Link>
          </li>
        )}
        {hasPermission(access, "rider.access") && (
          <li>
            <Link href="/rider" className={linkClass}>
              {t("riderLink")}
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}