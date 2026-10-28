import type { Prisma } from "../../generated/prisma/client";
import { db } from "../../lib/db";
import { escapeLike, queryTerms } from "../../lib/search-terms";
import { scoreProduct } from "./search-score";

const MAX_CANDIDATES = 500;

/** Every word must match somewhere. Text is escaped so % and _ are never wildcards. */
function termFilter(term: string): Prisma.ProductWhereInput {
  const like = { contains: escapeLike(term), mode: "insensitive" as const };
  return {
    OR: [
      { name: like },
      { nameMy: like },
      { description: like },
      { descriptionMy: like },
      { category: { is: { OR: [{ name: like }, { nameMy: like }] } } },
      { brand: { is: { name: like } } },
      { variants: { some: { isActive: true, OR: [{ color: like }, { sku: like }] } } },
      { specs: { some: { value: like } } },
    ],
  };
}

/** Ids of matching active products, best match first. */
export async function findSearchCandidates(q: string, limit = MAX_CANDIDATES): Promise<string[]> {
  const terms = queryTerms(q);
  if (terms.length === 0) return [];

  const rows = await db.product.findMany({
    where: { status: "ACTIVE", AND: terms.map(termFilter) },
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take: MAX_CANDIDATES,
    select: {
      id: true,
      name: true,
      nameMy: true,
      description: true,
      descriptionMy: true,
      soldCount: true,
      category: { select: { name: true, nameMy: true } },
      brand: { select: { name: true } },
      variants: { where: { isActive: true }, select: { color: true, sku: true } },
      specs: { select: { value: true } },
    },
  });

  return rows
    .map((r) => ({
      id: r.id,
      soldCount: r.soldCount,
      score: scoreProduct(
        {
          name: r.name,
          nameMy: r.nameMy,
          description: r.description,
          descriptionMy: r.descriptionMy,
          categoryNames: [r.category.name, r.category.nameMy ?? ""],
          brandName: r.brand?.name ?? null,
          colors: r.variants.map((v) => v.color),
          skus: r.variants.map((v) => v.sku),
          specValues: r.specs.map((s) => s.value),
        },
        terms,
        q,
      ),
    }))
    .sort((a, b) => b.score - a.score || b.soldCount - a.soldCount)
    .slice(0, limit)
    .map((r) => r.id);
}