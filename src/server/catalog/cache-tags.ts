/** Cache tags. Admin actions call updateTag(...) with these after changing data. */
export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
} as const;

export const productTag = (id: string) => `product-${id}`;