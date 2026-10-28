export interface SearchableProduct {
  name: string;
  nameMy: string | null;
  description: string | null;
  descriptionMy: string | null;
  categoryNames: string[];
  brandName: string | null;
  colors: string[];
  skus: string[];
  specValues: string[];
}

const has = (text: string | null | undefined, term: string) =>
  (text ?? "").toLowerCase().includes(term);

/** Higher is more relevant. Name beats category/brand, which beats colour/SKU/specs, which beats description. */
export function scoreProduct(product: SearchableProduct, terms: string[], fullQuery: string): number {
  const query = fullQuery.toLowerCase();
  const name = product.name.toLowerCase();
  let score = 0;

  if (name === query || (product.nameMy ?? "").toLowerCase() === query) score += 20;

  for (const raw of terms) {
    const term = raw.toLowerCase();

    if (name.startsWith(term)) score += 10;
    else if (name.includes(term)) score += 6;
    if (has(product.nameMy, term)) score += 6;

    if (product.categoryNames.some((c) => has(c, term)) || has(product.brandName, term)) score += 3;

    if (
      product.colors.some((c) => has(c, term)) ||
      product.skus.some((s) => has(s, term)) ||
      product.specValues.some((s) => has(s, term))
    ) {
      score += 2;
    }

    if (has(product.description, term) || has(product.descriptionMy, term)) score += 1;
  }

  return score;
}