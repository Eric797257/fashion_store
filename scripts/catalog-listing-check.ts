import "dotenv/config";
import { db } from "../src/lib/db";
import { queryProductListing, resolveCategoryIds } from "../src/server/catalog/listing-query";
import { resolvePrice } from "../src/server/catalog/pricing";
import { summarizeStock } from "../src/server/catalog/stock";
import {
  LISTING_PAGE_SIZE,
  parseListingParams,
  type ListingParams,
} from "../src/validation/catalog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

const base: ListingParams = { sort: "newest", page: 1, min: undefined, max: undefined, inStock: false };
const DAY = 24 * 60 * 60 * 1000;

async function makeProduct(opts: {
  slug: string;
  categoryId: string;
  price: number;
  salePrice?: number;
  saleStartsAt?: Date;
  saleEndsAt?: Date;
  stock: number;
}) {
  return db.product.create({
    data: {
      slug: opts.slug,
      name: opts.slug,
      categoryId: opts.categoryId,
      status: "ACTIVE",
      publishedAt: new Date(),
      price: opts.price,
      salePrice: opts.salePrice,
      saleStartsAt: opts.saleStartsAt,
      saleEndsAt: opts.saleEndsAt,
      variants: {
        create: [{ sku: `${opts.slug}-sku`.toUpperCase(), size: "M", color: "Black", stockOnHand: opts.stock }],
      },
    },
  });
}

async function main() {
  // ---------- URL parameters ----------
  const garbage = parseListingParams({ sort: "DROP TABLE", page: "-5", min: "abc", max: "", inStock: "yes" });
  report(
    "Bad URL parameters fall back to safe defaults",
    garbage.sort === "newest" && garbage.page === 1 && garbage.min === undefined && garbage.max === undefined && garbage.inStock === false,
  );
  const swapped = parseListingParams({ min: "50000", max: "10000" });
  report("A reversed price range is swapped", swapped.min === 10000 && swapped.max === 50000);
  report("An absurd page number falls back to page 1", parseListingParams({ page: "999999" }).page === 1);

  // ---------- Price rule ----------
  const now = new Date();
  const sale = { price: 45000, salePrice: 38000, saleStartsAt: null, saleEndsAt: null };
  const active = resolvePrice(sale, now);
  report("An active sale shows the sale price and percentage", active.onSale && active.price === 38000 && active.compareAtPrice === 45000 && active.percentOff === 16);
  report("An expired sale is ignored", !resolvePrice({ ...sale, saleEndsAt: new Date(now.getTime() - DAY) }, now).onSale);
  report("A sale that has not started yet is ignored", !resolvePrice({ ...sale, saleStartsAt: new Date(now.getTime() + DAY) }, now).onSale);
  report("A sale price that is not lower is ignored", !resolvePrice({ ...sale, salePrice: 45000 }, now).onSale);

  // ---------- Stock rule ----------
  const v = (onHand: number, reserved: number) => ({ stockOnHand: onHand, stockReserved: reserved, lowStockThreshold: 5, isActive: true });
  report(
    "Stock labels: sold out, low and in stock",
    summarizeStock([v(3, 3)]).status === "OUT_OF_STOCK" &&
      summarizeStock([v(8, 4)]).status === "LOW_STOCK" &&
      summarizeStock([v(40, 0)]).status === "IN_STOCK",
  );
  report("Reserved units are not available", summarizeStock([v(10, 7)]).available === 3);

  // ---------- Database queries with temporary products ----------
  const catPrice = await db.category.create({ data: { name: "Check price", slug: `check-price-${stamp}` } });
  const catPage = await db.category.create({ data: { name: "Check page", slug: `check-page-${stamp}` } });

  try {
    await makeProduct({ slug: `check-soldout-${stamp}`, categoryId: catPrice.id, price: 20000, stock: 0 });
    await makeProduct({
      slug: `check-future-${stamp}`, categoryId: catPrice.id, price: 30000,
      salePrice: 5000, saleStartsAt: new Date(now.getTime() + DAY), stock: 5,
    });
    await makeProduct({
      slug: `check-expired-${stamp}`, categoryId: catPrice.id, price: 50000,
      salePrice: 10000, saleStartsAt: new Date(now.getTime() - 30 * DAY),
      saleEndsAt: new Date(now.getTime() - DAY), stock: 5,
    });

    const priceIds = [catPrice.id];
    const slugs = (items: { slug: string }[]) => items.map((i) => i.slug.replace(`-${stamp}`, ""));

    const asc = await queryProductListing({ ...base, sort: "price-asc" }, "en", priceIds);
    report(
      "Price sort uses the effective price (expired and future sales do not count)",
      slugs(asc.items).join(",") === "check-soldout,check-future,check-expired",
      slugs(asc.items).join(","),
    );

    const desc = await queryProductListing({ ...base, sort: "price-desc" }, "en", priceIds);
    report("Price sort high to low works", slugs(desc.items)[0] === "check-expired");

    const minOnly = await queryProductListing({ ...base, min: 45000 }, "en", priceIds);
    report("Minimum price filter uses the effective price", slugs(minOnly.items).join(",") === "check-expired", slugs(minOnly.items).join(","));

    const maxOnly = await queryProductListing({ ...base, max: 25000 }, "en", priceIds);
    report("Maximum price filter uses the effective price", slugs(maxOnly.items).join(",") === "check-soldout", slugs(maxOnly.items).join(","));

    const inStock = await queryProductListing({ ...base, inStock: true }, "en", priceIds);
    report("In-stock filter hides sold-out products", inStock.total === 2 && !slugs(inStock.items).includes("check-soldout"));

    const all = await queryProductListing(base, "en", priceIds);
    const soldOut = all.items.find((i) => i.slug.startsWith("check-soldout"));
    report("Sold-out product is labelled OUT_OF_STOCK", soldOut?.stockStatus === "OUT_OF_STOCK");

    // Pagination: 14 products in one category = a full page of 12 plus a page of 2
    const pageProducts = Array.from({ length: 14 }, (_, i) => ({
      id: `check-pg-${i}-${stamp}`,
      slug: `check-pg-${String(i).padStart(2, "0")}-${stamp}`,
      name: `Page product ${i}`,
      categoryId: catPage.id,
      status: "ACTIVE" as const,
      price: 10000 + i * 100,
      publishedAt: new Date(now.getTime() - i * 1000),
    }));
    await db.product.createMany({ data: pageProducts });
    await db.productVariant.createMany({
      data: pageProducts.map((p) => ({
        productId: p.id, sku: `${p.slug}-sku`.toUpperCase(), size: "M", color: "Black", stockOnHand: 3,
      })),
    });

    const p1 = await queryProductListing(base, "en", [catPage.id]);
    const p2 = await queryProductListing({ ...base, page: 2 }, "en", [catPage.id]);
    const overlap = p1.items.filter((a) => p2.items.some((b) => b.id === a.id)).length;
    report(
      "Pagination: 14 products make a page of 12 and a page of 2, with no overlap",
      p1.items.length === LISTING_PAGE_SIZE && p2.items.length === 2 && p1.totalPages === 2 && p1.total === 14 && overlap === 0,
      `${p1.items.length} + ${p2.items.length}, overlap ${overlap}`,
    );

    const beyond = await queryProductListing({ ...base, page: 50 }, "en", [catPage.id]);
    report("A page past the end is clamped to the last page", beyond.page === 2 && beyond.items.length === 2);

    // ---------- Sample data ----------
    const global = await queryProductListing({ ...base, sort: "price-desc" }, "en", null);
    const prices = global.items.map((i) => i.price);
    report("Sorting the whole catalog by price high to low is in order", prices.every((p, i) => i === 0 || (prices[i - 1] ?? 0) >= p));

    const linen = (await queryProductListing(base, "en", null)).items.find((i) => i.slug === "sample-linen-shirt");
    if (linen) {
      report("Sample linen shirt shows 38,000 with 45,000 crossed out (16% off)", linen.price === 38000 && linen.compareAtPrice === 45000 && linen.percentOff === 16);
    } else {
      console.log("ℹ️  Sample linen shirt not on the first page (or sample data not seeded). Skipped.");
    }

    const womenIds = await resolveCategoryIds("women");
    if (womenIds) {
      const women = await queryProductListing({ ...base }, "en", womenIds);
      const womenSlugs = women.items.map((i) => i.slug);
      report(
        "A parent category includes its sub-categories",
        womenSlugs.includes("sample-floral-midi-dress") && womenSlugs.includes("sample-ribbed-top") && !womenSlugs.includes("sample-linen-shirt"),
      );
    } else {
      console.log("ℹ️  Category 'women' not found (sample data not seeded). Skipped.");
    }

    report("An unknown category slug is reported as missing", (await resolveCategoryIds("does-not-exist")) === null);

    const my = await queryProductListing(base, "my", priceIds);
    report("Burmese listing works (falls back to English when no Burmese name)", my.items.length === 3);
  } finally {
    await db.product.deleteMany({ where: { slug: { startsWith: "check-" } } });
    await db.category.deleteMany({ where: { slug: { startsWith: "check-" } } });
  }

  const left = await db.product.count({ where: { slug: { startsWith: "check-" } } });
  report("No test products left behind", left === 0);

  // ---------- The real pages (optional: needs the dev server) ----------
  try {
    const fetchPage = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { "x-forwarded-for": "203.0.113.9" } });
    const ok = await fetchPage("/products");
    const html = await ok.text();
    report("/products opens", ok.status === 200, `status ${ok.status}`);
    report("/products shows sample products", html.includes("Sample Linen Shirt") || html.includes("Sample Wrap Dress"));

    const cat = await fetchPage("/categories/women");
    const catHtml = await cat.text();
    report("/categories/women opens and lists women's products", cat.status === 200 && catHtml.includes("Sample Floral Midi Dress"), `status ${cat.status}`);

    const missing = await fetchPage("/categories/does-not-exist");
    const missingHtml = await missing.text();
    report(
      "An unknown category is a 404",
      missing.status === 404 || /<meta[^>]*name="next-error"[^>]*not-found/.test(missingHtml),
      `status ${missing.status}`,
    );

    const far = await fetchPage("/products?page=99");
    report("A page number past the end redirects", far.status >= 300 && far.status < 400 || (await far.text()).includes("__next-page-redirect"));
  } catch {
    console.log("ℹ️  Dev server not reachable. Skipped the page checks.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    failed = true;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failed ? 1 : 0);
  });