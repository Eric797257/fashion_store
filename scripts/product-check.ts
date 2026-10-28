import "dotenv/config";
import { db } from "../src/lib/db";
import { publicReviewerName } from "../src/lib/display-name";
import {
    findVariant,
    imagesForColor,
    initialSelection,
    sizeAfterColorChange,
    type ImageOption,
    type VariantOption,
} from "../src/lib/variant-selection";
import { queryLiveStock, queryProductDetail, queryReviews } from "../src/server/catalog/detail-query";
import { queryRelatedProducts } from "../src/server/catalog/related-query";
import { buildProductJsonLd, serializeJsonLd } from "../src/server/catalog/structured-data";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let failed = false;

function report(name: string, ok: boolean, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
    if (!ok) failed = true;
}

interface LdProduct {
    "@type"?: string;
    offers?: { priceCurrency?: string }[];
}

function extractProductJsonLd(html: string): LdProduct | null {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) return null;
    try {
        return JSON.parse(match[1]) as LdProduct;
    } catch {
        return null;
    }
}

const v = (id: string, size: string, color: string, available: number, low = false): VariantOption => ({
    id, sku: `SKU-${id}`, size, color, colorHex: null, available, low,
});

async function main() {
    // ---------- Variant picker rules ----------
    const variants = [v("1", "S", "White", 5), v("2", "M", "White", 0), v("3", "S", "Navy", 0), v("4", "M", "Navy", 2, true)];

    report("Default choice is the first variant in stock", JSON.stringify(initialSelection(variants, {})) === JSON.stringify({ color: "White", size: "S" }));
    report("A colour from the URL is honoured", initialSelection(variants, { color: "Navy" })?.size === "M");
    report("A real colour and size from the URL are honoured, even if sold out", initialSelection(variants, { color: "Navy", size: "S" })?.size === "S");
    report("Nonsense in the URL falls back to the default", initialSelection(variants, { color: "Purple", size: "XXL" })?.color === "White");
    report("Changing colour keeps the size when it is in stock", sizeAfterColorChange(variants, "White", "S") === "S");
    report("Changing colour moves to an in-stock size when needed", sizeAfterColorChange(variants, "Navy", "S") === "M");
    report("A combination that does not exist is not found", findVariant(variants, "White", "XL") === null);

    const images: ImageOption[] = [
        { url: "/all.jpg", alt: "", color: null },
        { url: "/white.jpg", alt: "", color: "White" },
        { url: "/navy.jpg", alt: "", color: "Navy" },
    ];
    report("Photos follow the chosen colour", imagesForColor(images, "Navy").map((i) => i.url).join() === "/all.jpg,/navy.jpg");
    report("If no photo matches, all photos are shown", imagesForColor([{ url: "/w.jpg", alt: "", color: "White" }], "Navy").length === 1);

    // ---------- Reviewer privacy ----------
    report(
        "Reviewer names are shortened",
        publicReviewerName("Aye Chan Myae") === "Aye M." && publicReviewerName("Mya") === "Mya" && publicReviewerName("  ") === "",
    );

    // ---------- Google structured data ----------
    const ld = buildProductJsonLd({
        baseUrl: "https://shop.example", slug: "x", name: "Shirt </script><b>", description: "Nice",
        brandName: null, images: [{ url: "/sample/x.svg" }, { url: "/p/a.jpg" }], currency: "MMK",
        price: 38000, onSale: true, saleEndsAt: "2026-12-31T00:00:00.000Z",
        variants: [{ sku: "A", available: 3, low: false }, { sku: "B", available: 0, low: false }, { sku: "C", available: 2, low: true }],
        ratingAverage: 4.5, ratingCount: 2,
    });
    const offers = ld.offers as { availability: string; priceCurrency: string }[];
    report(
        "Structured data has one offer per variant with correct availability",
        offers.length === 3 &&
        offers[0]?.availability.endsWith("InStock") === true &&
        offers[1]?.availability.endsWith("OutOfStock") === true &&
        offers[2]?.availability.endsWith("LimitedAvailability") === true &&
        offers[0]?.priceCurrency === "MMK",
    );
    report("SVG placeholders are left out of structured data", JSON.stringify(ld.image) === JSON.stringify(["https://shop.example/p/a.jpg"]));
    report("Structured data includes the rating", Boolean(ld.aggregateRating));
    report("Product text can never close the script tag", !serializeJsonLd(ld).includes("</script>") && !serializeJsonLd(ld).includes("<"));

    // ---------- Database ----------
    const cat = await db.category.create({ data: { name: "Check", slug: `check-detail-${stamp}` } });
    try {
        const mk = (suffix: string, status: "ACTIVE" | "DRAFT", variants: { stock: number; reserved?: number; active?: boolean; threshold?: number }[]) =>
            db.product.create({
                data: {
                    slug: `check-${suffix}-${stamp}`, name: `Check ${suffix}`, categoryId: cat.id, status, publishedAt: new Date(), price: 10000,
                    variants: {
                        create: variants.map((x, i) => ({
                            sku: `CHECK-${suffix}-${i}-${stamp}`.toUpperCase(), size: String(i), color: "Black",
                            stockOnHand: x.stock, stockReserved: x.reserved ?? 0, isActive: x.active ?? true, lowStockThreshold: x.threshold ?? 5,
                        })),
                    },
                },
            });

        const draft = await mk("draft", "DRAFT", [{ stock: 5 }]);
        report("A draft product is not public", (await queryProductDetail(draft.slug, "en")) === null);

        const live = await mk("live", "ACTIVE", [{ stock: 6, reserved: 4 }, { stock: 20 }, { stock: 9, active: false }]);
        const stock = await queryLiveStock(live.id);
        const sorted = [...stock].sort((a, b) => a.available - b.available);
        report(
            "Live stock: reserved units are subtracted, inactive variants are ignored, low is flagged",
            stock.length === 2 && sorted[0]?.available === 2 && sorted[0].low === true && sorted[1]?.available === 20 && sorted[1].low === false,
            stock.map((s) => s.available).join(","),
        );

        const a = await mk("a", "ACTIVE", [{ stock: 3 }]);
        await mk("b", "ACTIVE", [{ stock: 3 }]);
        const related = await queryRelatedProducts(live.id, cat.id, "en", 4);
        report(
            "Related products: same category first, never the product itself, filled up to 4",
            related.length === 4 && !related.some((r) => r.id === live.id) && related.slice(0, 2).every((r) => r.slug.startsWith("check-")) && related.some((r) => r.id === a.id),
            related.map((r) => r.slug.replace(`-${stamp}`, "")).join(","),
        );

        const noReviews = await queryReviews(live.id);
        report("A product without reviews has an empty summary", noReviews.count === 0 && noReviews.reviews.length === 0);

        // Sample product (needs seeded sample data)
        const sample = await queryProductDetail("sample-linen-shirt", "en");
        if (sample) {
            report(
                "Sample linen shirt: 8 variants, sale price, specifications",
                sample.variants.length === 8 && sample.price === 38000 && sample.onSale && sample.specs.some((s) => s.label === "Material"),
            );
            const sampleStock = await queryLiveStock(sample.id);
            const bySku = new Map(sample.variants.map((x) => [x.sku, sampleStock.find((s) => s.variantId === x.id)]));
            const navyM = bySku.get("SAMPLE-LSH-M-NAV");
            const whiteM = bySku.get("SAMPLE-LSH-M-WHI");
            report(
                "Sample stock: M/Navy is sold out, M/White is low",
                navyM?.available === 0 && whiteM?.available === 2 && whiteM.low === true,
                `${navyM?.available}, ${whiteM?.available}`,
            );
        } else {
            console.log("ℹ️  Sample data not seeded. Skipped the sample product checks.");
        }
    } finally {
        await db.product.deleteMany({ where: { slug: { startsWith: "check-" } } });
        await db.category.deleteMany({ where: { slug: { startsWith: "check-" } } });
    }

    // ---------- The real page (needs the dev server) ----------
    try {
        const get = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { "x-forwarded-for": "203.0.113.9" } });

        const res = await get("/products/sample-linen-shirt?color=Navy&size=L");
        const html = await res.text();
        report("Product page opens", res.status === 200 && html.includes("Sample Linen Shirt"), `status ${res.status}`);

        const data = extractProductJsonLd(html);
        const offers = data?.offers ?? [];
        report(
            "Page contains valid Product structured data with 8 offers in MMK",
            data?.["@type"] === "Product" && offers.length === 8 && offers[0]?.priceCurrency === "MMK",
        );
        report("Cart buttons are disabled while ordering is not open", /<button[^>]*disabled[^>]*>\s*Add to cart/.test(html) || html.includes("Online ordering is being set up"));

        const missing = await get("/products/does-not-exist");
        const missingHtml = await missing.text();
        report(
            "An unknown product is a 404",
            missing.status === 404 || /<meta[^>]*name="next-error"[^>]*not-found/.test(missingHtml),
            `status ${missing.status}`,
        );

        const bad = await get("/products/%3Cscript%3E");
        const badHtml = await bad.text();
        report("A malformed slug is a 404", bad.status === 404 || /<meta[^>]*name="next-error"[^>]*not-found/.test(badHtml));
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