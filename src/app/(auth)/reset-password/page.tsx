import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("resetTitle"),
    robots: { index: false },
    referrer: "no-referrer", // the token is in the URL, so never leak it to other sites 
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const { token, error } = await searchParams;
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const t = await getTranslations("Auth");

  if (error || !tokenValue) {
    return (
      <AuthCard title={t("resetInvalidTitle")} subtitle={t("resetInvalidBody")}>
        <Link
          href="/forgot-password"
          className={cn(
            buttonVariants(),
            "h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover",
          )}
        >
          {t("requestNewLink")}
        </Link>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={tokenValue} />;
}