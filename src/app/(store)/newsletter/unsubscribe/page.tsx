import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewsletterTokenForm } from "@/components/store/newsletter/token-form";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Newsletter");
  return { title: t("unsubscribeTitle"), robots: { index: false }, referrer: "no-referrer" };
}

export default async function UnsubscribeNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const t = await getTranslations("Newsletter");

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="text-4xl font-semibold">{t("unsubscribeTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("unsubscribeBody")}</p>
      <div className="mt-8">
        {value ? (
          <NewsletterTokenForm mode="unsubscribe" token={value.slice(0, 200)} />
        ) : (
          <p className="text-destructive">{t("invalidLink")}</p>
        )}
      </div>
    </div>
  );
}