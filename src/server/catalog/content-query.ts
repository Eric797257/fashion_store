import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import type { CatalogLocale } from "./types";

export const CONTENT_SLUGS = [
  "about",
  "shipping-policy",
  "return-policy",
  "privacy-policy",
  "terms",
] as const;
export type ContentSlug = (typeof CONTENT_SLUGS)[number];

export interface ContentPageData {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
}

export async function queryContentPage(
  slug: string,
  locale: CatalogLocale,
): Promise<ContentPageData | null> {
  const row = await db.contentPage.findUnique({ where: { slug } });
  if (!row) return null;
  return {
    slug: row.slug,
    title: localized(row.title, row.titleMy, locale),
    body: locale === "my" && row.bodyMy ? row.bodyMy : row.body,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Support phone and email from store settings, when the owner has set them. */
export async function queryContactOverrides(): Promise<{ phone: string | null; email: string | null }> {
  const settings = await db.storeSettings.findUnique({
    where: { id: "default" },
    select: { supportPhone: true, supportEmail: true },
  });
  return { phone: settings?.supportPhone ?? null, email: settings?.supportEmail ?? null };
}