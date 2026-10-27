export type CatalogLocale = "en" | "my";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface ProductImageData {
  url: string;
  alt: string;
}

/** Plain data only (numbers, strings), so it can be cached and sent to the browser. */
export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  image: ProductImageData | null;
  hoverImage: ProductImageData | null;
  price: number;
  compareAtPrice: number | null;
  onSale: boolean;
  percentOff: number;
  stockStatus: StockStatus;
  colors: { name: string; hex: string | null }[];
  ratingAverage: number;
  ratingCount: number;
  isNew: boolean;
}

export interface ProductListing {
  items: ProductCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}