import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewsletterTokenForm } from "@/components/store/newsletter/token-form";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Newsletter");
  return {
    title: t("confirmTitle"),
    robots: { index: false },
    referrer: "no-referrer", // the token is in the address, so never leak it to other sites
  };
}

export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const t = await getTranslations("Newsletter");

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="text-4xl font-semibold">{t("confirmTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("confirmBody")}</p>
      <div className="mt-8">
        {value ? (
          <NewsletterTokenForm mode="confirm" token={value.slice(0, 200)} />
        ) : (
          <p className="text-destructive">{t("invalidLink")}</p>
        )}
      </div>
    </div>
  );
}