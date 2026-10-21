import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const instant = false; // reads the session (request data)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeRedirectPath(Array.isArray(next) ? next[0] : next);

  if (await getSession()) redirect(target);

  return <SignInForm next={target} />;
}