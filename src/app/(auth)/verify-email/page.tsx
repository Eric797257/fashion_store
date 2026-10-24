import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { getSession } from "@/server/auth/session";
import { emailSchema } from "@/validation/auth";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("verifyTitle"), robots: { index: false } };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; social?: string | string[] }>;
}) {
  const session = await getSession();
  if (session?.user.emailVerified) redirect("/account");

  const params = await searchParams;
  const parsed = emailSchema.safeParse(first(params.email));
  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("verifyTitle")}
      subtitle={
        parsed.success
          ? t("verifySentTo", { email: parsed.data })
          : first(params.social)
            ? t("verifySocial")
            : t("verifySentGeneric")
      }
    >
      <VerifyEmailPanel email={parsed.success ? parsed.data : undefined} />
    </AuthCard>
  );
}