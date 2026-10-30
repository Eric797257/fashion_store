/** Cache tags. Admin actions call updateTag(...) with these after changing data. */
export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
  reviews: "reviews",
  settings: "settings",
  banners: "banners",
  testimonials: "testimonials",
  content: "content",
} as const;

export const productTag = (id: string) => `product-${id}`;
export const productSlugTag = (slug: string) => `product-slug-${slug}`;