export interface StructuredDataInput {
  baseUrl: string;
  slug: string;
  name: string;
  description: string | null;
  brandName: string | null;
  images: { url: string }[];
  currency: string;
  price: number;
  onSale: boolean;
  saleEndsAt: string | null;
  variants: { sku: string; available: number; low: boolean }[];
  ratingAverage: number;
  ratingCount: number;
}

const absolute = (baseUrl: string, url: string) =>
  url.startsWith("http") ? url : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;

export function buildProductJsonLd(input: StructuredDataInput): Record<string, unknown> {
  const url = `${input.baseUrl}/products/${input.slug}`;

  // Google needs real photos, so the SVG sample placeholders are left out
  const images = input.images
    .filter((i) => !i.url.toLowerCase().endsWith(".svg"))
    .map((i) => absolute(input.baseUrl, i.url));

  const availability = (v: { available: number; low: boolean }) =>
    v.available === 0
      ? "https://schema.org/OutOfStock"
      : v.low
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url,
    offers: input.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      url,
      priceCurrency: input.currency,
      price: input.price.toFixed(2),
      availability: availability(v),
      itemCondition: "https://schema.org/NewCondition",
      ...(input.onSale && input.saleEndsAt
        ? { priceValidUntil: input.saleEndsAt.slice(0, 10) }
        : {}),
    })),
  };

  if (images.length > 0) data.image = images;
  if (input.description) data.description = input.description.slice(0, 5000);
  if (input.brandName) data.brand = { "@type": "Brand", name: input.brandName };
  if (input.ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.ratingAverage.toFixed(1),
      reviewCount: input.ratingCount,
    };
  }
  return data;
}

/** JSON for a <script> tag. "<" is escaped so product text can never close the tag. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildWebsiteJsonLd(input: {
  baseUrl: string;
  name: string;
  logoUrl?: string;
  sameAs: string[];
}): Record<string, unknown> {
  const org = `${input.baseUrl}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: input.name,
        url: input.baseUrl,
        ...(input.logoUrl ? { logo: input.logoUrl } : {}),
        ...(input.sameAs.length > 0 ? { sameAs: input.sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${input.baseUrl}/#website`,
        url: input.baseUrl,
        name: input.name,
        publisher: { "@id": org },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${input.baseUrl}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}