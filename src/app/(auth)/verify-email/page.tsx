import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { getSession } from "@/server/auth/session";
import { emailSchema } from "@/validation/auth";

export const instant = false;

export async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const session = await getSession();
  if (session?.user.emailVerified) redirect("/account");

  const { email } = await searchParams;
  const parsed = emailSchema.safeParse(Array.isArray(email) ? email[0] : email);
  const t = await getTranslations("Auth");
  
  return (
    <AuthCard 
      title={t("verifyTitle")}
      subtitle={
        parsed.success ? t("verifySentTo", { email: parsed.data }) : t("verifySentGeneric")
      }
    >
      <VerifyEmailPanel email={parsed.success ? parsed.data : undefined} />
    </AuthCard>
  );
}