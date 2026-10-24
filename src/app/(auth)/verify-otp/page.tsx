import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { TwoFactorOtpForm } from "@/components/auth/two-factor-otp-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor");
  return { title: t("otpTitle"), robots: { index: false } };
}

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeRedirectPath(Array.isArray(next) ? next[0] : next);

  if (await getSession()) redirect(target);

  return <TwoFactorOtpForm next={target} />;
}