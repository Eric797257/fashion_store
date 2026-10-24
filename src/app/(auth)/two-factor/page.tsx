import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor");
  return { title: t("challengeTitle"), robots: { index: false } };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; otp?: string | string[] }>;
}) {
  const params = await searchParams;
  const target = safeRedirectPath(first(params.next));

  if (await getSession()) redirect(target);

  return <TwoFactorForm next={target} showEmailOption={first(params.otp) === "1"} />;
}