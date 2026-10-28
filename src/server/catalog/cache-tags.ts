/** Cache tags. Admin actions call updateTag(...) with these after changing data. */
export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
  reviews: "reviews",
  settings: "settings",
} as const;

export const productTag = (id: string) => `product-${id}`;
export const productSlugTag = (slug: string) => `product-slug-${slug}`;