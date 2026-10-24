import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reset?: string | string[] }>;
}) {
  const { next, reset } = await searchParams;
  const target = safeRedirectPath(Array.isArray(next) ? next[0] : next);

  if (await getSession()) redirect(target);

  const t = await getTranslations("Auth");
  const resetFlag = Array.isArray(reset) ? reset[0] : reset;

  return (
    <SignInForm next={target} notice={resetFlag === "1" ? t("passwordResetDone") : null} />
  );
}