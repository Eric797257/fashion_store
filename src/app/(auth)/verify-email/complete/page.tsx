import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/auth/session";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("verifyDoneTitle"), robots: { index: false } };
}

export default async function VerifyEmailCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  // The link was invalid, expired or already used
  if (error) {
    return (
      <AuthCard title={t("verifyFailedTitle")} subtitle={t("verifyFailedBody")}>
        <VerifyEmailPanel />
      </AuthCard>
    );
  }

  const session = await getSession();
  if (!session?.user.emailVerified) redirect("/verify-email");

  return (
    <AuthCard title={t("verifyDoneTitle")} subtitle={t("verifyDoneBody")}>
      <Link
        href="/account"
        className={cn(
          buttonVariants(),
          "h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover",
        )}
      >
        {t("continueToAccount")}
      </Link>
    </AuthCard>
  );
}