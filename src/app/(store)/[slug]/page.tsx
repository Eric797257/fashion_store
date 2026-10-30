import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { SimpleContent } from "@/components/content/simple-content";
import { resolveLocale } from "@/i18n/locale";
import { CONTENT_SLUGS, type ContentSlug } from "@/server/catalog/content-query";
import { getContentPage } from "@/server/catalog/home";

export const instant = false;

type Props = { params: Promise<{ slug: string }> };

const isContentSlug = (slug: string): slug is ContentSlug =>
  (CONTENT_SLUGS as readonly string[]).includes(slug);

const TITLE_KEY: Record<ContentSlug, string> = {
  about: "titleAbout",
  "shipping-policy": "titleShipping",
  "return-policy": "titleReturn",
  "privacy-policy": "titlePrivacy",
  terms: "titleTerms",
};

function firstSentence(body: string): string | undefined {
  const plain = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("["));
  if (!plain) return undefined;
  return plain.length > 155 ? `${plain.slice(0, 152)}…` : plain;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isContentSlug(slug)) return {};

  const [t, page] = await Promise.all([
    getTranslations("Content"),
    getContentPage(slug, resolveLocale(await getLocale())),
  ]);

  return {
    title: page?.title ?? t(TITLE_KEY[slug]),
    description: page ? firstSentence(page.body) : undefined,
    alternates: { canonical: `/${slug}` },
    // A page that has no text yet should not be indexed
    robots: page ? undefined : { index: false, follow: true },
  };
}

function LastUpdated({ iso }: { iso: string }) {
  const t = useTranslations("Content");
  const format = useFormatter();
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {t("lastUpdated", { date: format.dateTime(new Date(iso), { dateStyle: "medium" }) })}
    </p>
  );
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  if (!isContentSlug(slug)) notFound();

  const locale = resolveLocale(await getLocale());
  const [t, tc, page] = await Promise.all([
    getTranslations("Content"),
    getTranslations("Catalog"),
    getContentPage(slug, locale),
  ]);

  const title = page?.title ?? t(TITLE_KEY[slug]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ label: tc("breadcrumbHome"), href: "/" }, { label: title }]} />

      <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{title}</h1>

      {page ? (
        <>
          <LastUpdated iso={page.updatedAt} />
          <div className="mt-8">
            <SimpleContent text={page.body} />
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">{t("preparing")}</p>
          <p className="mt-2 text-muted-foreground">{t("preparingBody")}</p>
          <Link href="/contact" className="mt-4 inline-block text-primary hover:underline">
            {t("contactTitle")}
          </Link>
        </div>
      )}
    </div>
  );
}