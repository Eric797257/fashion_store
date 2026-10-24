import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { socialErrorKey } from "@/lib/social-errors";
import { getSession } from "@/server/auth/session";
import { getEnabledProviders } from "@/server/auth/providers";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    reset?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const target = safeRedirectPath(first(params.next));
  const errorCode = first(params.error);

  if (await getSession()) redirect(target);

  // Facebook sign-in created the account, but the email still has to be verified
  if (errorCode === "email_not_verified") redirect("/verify-email?social=1");

  const t = await getTranslations("Auth");
  const errKey = socialErrorKey(errorCode);

  return (
    <SignInForm
      next={target}
      notice={first(params.reset) === "1" ? t("passwordResetDone") : null}
      providers={getEnabledProviders()}
      initialError={errKey ? t(`errors.${errKey}`) : null}
    />
  );
}