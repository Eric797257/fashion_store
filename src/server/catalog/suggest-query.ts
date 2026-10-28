import { db } from "../../lib/db";
import { localized } from "../../i18n/localized";
import { escapeLike } from "../../lib/search-terms";
import { fetchRows, toCard } from "./listing-query";
import { findSearchCandidates } from "./search-candidates";
import type { CatalogLocale } from "./types";

export interface SuggestionProduct {
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageAlt: string;
}

export interface Suggestions {
  products: SuggestionProduct[];
  categories: { slug: string; name: string }[];
}

export async function querySuggestions(q: string, locale: CatalogLocale): Promise<Suggestions> {
  const like = { contains: escapeLike(q), mode: "insensitive" as const };

  const [ids, categories] = await Promise.all([
    findSearchCandidates(q, 6),
    db.category.findMany({
      where: { isActive: true, OR: [{ name: like }, { nameMy: like }] },
      orderBy: { sortOrder: "asc" },
      take: 3,
      select: { slug: true, name: true, nameMy: true },
    }),
  ]);

  const rows = ids.length > 0 ? await fetchRows(ids) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();

  const products = ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const card = toCard(row, locale, now);
    return [
      {
        slug: card.slug,
        name: card.name,
        price: card.price,
        compareAtPrice: card.compareAtPrice,
        imageUrl: card.image?.url ?? null,
        imageAlt: card.image?.alt ?? card.name,
      },
    ];
  });

  return {
    products,
    categories: categories.map((c) => ({ slug: c.slug, name: localized(c.name, c.nameMy, locale) })),
  };
}