import "dotenv/config";
import { db } from "../src/lib/db";
import { listingHref } from "../src/lib/listing-url";
import { escapeLike, normalizeQuery, queryTerms } from "../src/lib/search-terms";
import { compareSizes } from "../src/lib/size-order";
import { queryProductListing } from "../src/server/catalog/listing-query";
import { scoreProduct } from "../src/server/catalog/search-score";
import { querySuggestions } from "../src/server/catalog/suggest-query";
import { parseListingParams, type ListingParams } from "../src/validation/catalog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

const base: ListingParams = {
  q: undefined, sort: "newest", page: 1, min: undefined, max: undefined,
  inStock: false, brand: [], color: [], size: [], audience: [],
};

const fromHref = (href: string) => {
  const url = new URL(href, "http://x");
  const raw: Record<string, string[]> = {};
  for (const key of new Set(url.searchParams.keys())) raw[key] = url.searchParams.getAll(key);
  return parseListingParams(raw);
};

async function main() {
  // ---------- Search text rules ----------
  report("Query is cleaned (control characters, spaces)", normalizeQuery("  Linen\u0000   Shirt  ") === "Linen Shirt");
  report("Query is capped at 80 characters", Array.from(normalizeQuery("a".repeat(200)) ?? "").length === 80);
  report("An empty query is nothing", normalizeQuery("   ") === undefined && normalizeQuery(null) === undefined);
  report("Terms: no duplicates, at most 5", queryTerms("a A b c d e f").join(",") === "a,b,c,d,e");
  report("LIKE characters are escaped", escapeLike("100%_\\") === "100\\%\\_\\\\");
  report(
    "Sizes sort naturally",
    ["XL", "M", "S", "L", "XS", "Free Size", "32", "30"].sort(compareSizes).join(",") === "XS,S,M,L,XL,30,32,Free Size",
  );

  const prod = (over: Partial<Parameters<typeof scoreProduct>[0]>) => ({
    name: "", nameMy: null, description: null, descriptionMy: null, categoryNames: [] as string[],
    brandName: null, colors: [] as string[], skus: [] as string[], specValues: [] as string[], ...over,
  });
  const terms = ["linen"];
  report(
    "Relevance: name start > name contains > category > colour/spec > description",
    scoreProduct(prod({ name: "Linen shirt" }), terms, "linen") >
      scoreProduct(prod({ name: "Soft linen shirt" }), terms, "linen") &&
      scoreProduct(prod({ name: "Soft linen shirt" }), terms, "linen") >
        scoreProduct(prod({ categoryNames: ["Linen"] }), terms, "linen") &&
      scoreProduct(prod({ categoryNames: ["Linen"] }), terms, "linen") >
        scoreProduct(prod({ specValues: ["Linen"] }), terms, "linen") &&
      scoreProduct(prod({ specValues: ["Linen"] }), terms, "linen") >
        scoreProduct(prod({ description: "made of linen" }), terms, "linen"),
  );

  // ---------- URL parameters ----------
  const parsed = parseListingParams({
    q: "  linen   shirt ",
    brand: ["nike", "BAD SLUG!", "adidas"],
    color: ["Navy", "navy", "Black"],
    size: "M",
    audience: ["women", "alien", "men"],
  });
  report(
    "Search and filter parameters are cleaned",
    parsed.q === "linen shirt" &&
      parsed.brand.join() === "nike,adidas" &&
      parsed.color.join() === "Navy,Black" &&
      parsed.size.join() === "M" &&
      parsed.audience.join() === "women,men",
  );
  report("Searching defaults to relevance, browsing to newest", parsed.sort === "relevance" && parseListingParams({ sort: "relevance" }).sort === "newest");

  const round = fromHref(listingHref("/search", { ...parsed, min: 10000, max: 50000, inStock: true, page: 2 }));
  report("A filtered URL survives a round trip", JSON.stringify(round) === JSON.stringify({ ...parsed, min: 10000, max: 50000, inStock: true, page: 2 }));

  // ---------- Database (temporary products) ----------
  const cat = await db.category.create({
    data: { name: "Check Search", slug: `check-search-${stamp}` },
  });
  const brandA = await db.brand.create({ data: { name: "Kestrel Wear", slug: `check-kestrel-${stamp}` } });

  const mk = (opts: {
    key: string; name: string; description?: string; nameMy?: string; audience: "WOMEN" | "MEN" | "UNISEX";
    brandId?: string; spec?: string; variants: { size: string; color: string; stock: number; sku?: string }[];
  }) =>
    db.product.create({
      data: {
        slug: `check-${opts.key}-${stamp}`, name: opts.name, nameMy: opts.nameMy, description: opts.description,
        categoryId: cat.id, brandId: opts.brandId, audience: opts.audience, status: "ACTIVE",
        publishedAt: new Date(), price: 40000,
        variants: {
          create: opts.variants.map((v, i) => ({
            sku: v.sku ?? `CHECK-${opts.key}-${i}-${stamp}`.toUpperCase(),
            size: v.size, color: v.color, stockOnHand: v.stock,
          })),
        },
        specs: opts.spec ? { create: [{ label: "Material", value: opts.spec }] } : undefined,
      },
    });

  try {
    const p1 = await mk({
      key: "p1", name: "Kestrel Linen Shirt", description: "Cool summer shirt", nameMy: "ကက်စထရယ် ရှပ်အင်္ကျီ",
      audience: "MEN", brandId: brandA.id, spec: "Organic hemp",
      variants: [{ size: "L", color: "Navy", stock: 5 }, { size: "S", color: "Navy", stock: 0 }, { size: "M", color: "Black", stock: 4 }],
    });
    const p2 = await mk({
      key: "p2", name: "Plain tee", description: "A soft tee with a kestrel print", audience: "WOMEN",
      spec: "100% cotton", variants: [{ size: "M", color: "Cream", stock: 3 }, { size: "L", color: "Black", stock: 2 }],
    });
    const p3 = await mk({
      key: "p3", name: "Mystery trousers", description: "Nothing special", audience: "UNISEX",
      variants: [{ size: "32", color: "White", stock: 0, sku: `CHECK-ZEBRA-${stamp}` }],
    });

    const scope = [cat.id];
    const find = async (over: Partial<ListingParams>) =>
      queryProductListing({ ...base, ...over }, "en", scope);
    const idsOf = (l: { items: { id: string }[] }) => l.items.map((i) => i.id);
    const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((id) => a.includes(id));

    // ----- Search -----
    const r1 = await find({ q: "kestrel", sort: "relevance" });
    report("Search: name/brand match ranks above a description match", idsOf(r1).join() === `${p1.id},${p2.id}`, `${r1.total} results`);
    report("Search: every word must match", sameSet(idsOf(await find({ q: "kestrel shirt" })), [p1.id]));
    report("Search finds specification values", sameSet(idsOf(await find({ q: "hemp" })), [p1.id]));
    report("Search finds colours", sameSet(idsOf(await find({ q: "cream" })), [p2.id]));
    report("Search finds SKUs (any letter case)", sameSet(idsOf(await find({ q: `zebra-${stamp}` })), [p3.id]));
    report("Search finds brand names", sameSet(idsOf(await find({ q: "wear" })), [p1.id]));
    report("Search finds category names", (await find({ q: "check search" })).total === 3);
    report("Search finds Burmese text", sameSet(idsOf(await find({ q: "ရှပ်" })), [p1.id]));
    report(
      "A literal % only matches a literal % (not everything)",
      sameSet(idsOf(await find({ q: "%" })), [p2.id]),
      `${(await find({ q: "%" })).total} results`,
    );
    report("An underscore is not a wildcard", (await find({ q: "_" })).total === 0, `${(await find({ q: "_" })).total} results`);
    report("Text that matches nothing returns nothing", (await find({ q: "qqqqzzzz" })).total === 0);

    // ----- Filters -----
    report("Colour filter", sameSet(idsOf(await find({ color: ["Navy"] })), [p1.id]));
    report("Colour filter ignores letter case", sameSet(idsOf(await find({ color: ["navy"] })), [p1.id]));
    report("Colour + size must be the same variant (Navy + S exists)", sameSet(idsOf(await find({ color: ["Navy"], size: ["S"] })), [p1.id]));
    report("Colour + size must be the same variant (Black + L is the other product)", sameSet(idsOf(await find({ color: ["Black"], size: ["L"] })), [p2.id]));
    report("Colour + size must be the same variant (Navy + M does not exist)", (await find({ color: ["Navy"], size: ["M"] })).total === 0);
    report("In stock applies to the same variant (Navy + S is sold out)", (await find({ color: ["Navy"], size: ["S"], inStock: true })).total === 0);
    report("In stock applies to the same variant (Navy + L is available)", sameSet(idsOf(await find({ color: ["Navy"], size: ["L"], inStock: true })), [p1.id]));
    report("Brand filter", sameSet(idsOf(await find({ brand: [brandA.slug] })), [p1.id]));
    report("Audience filter", sameSet(idsOf(await find({ audience: ["women"] })), [p2.id]));
    report("Audience filter with two values", sameSet(idsOf(await find({ audience: ["unisex", "men"] })), [p1.id, p3.id]));

    // ----- Facets -----
    const f = (await find({ color: ["Navy"] })).facets;
    const blackCount = f.colors.find((c) => c.name === "Black")?.count;
    report(
      "Option lists ignore your own colour choice (Black is still offered, with its count)",
      f.colors.some((c) => c.name === "Navy") && blackCount === 2 && f.colors.some((c) => c.name === "Cream"),
      f.colors.map((c) => `${c.name}:${c.count}`).join(","),
    );
    report("Size options are sorted naturally", f.sizes.map((s) => s.name).join() === "S,M,L,32", f.sizes.map((s) => s.name).join());
    report("Brand option has its count", f.brands.length === 1 && f.brands[0]?.slug === brandA.slug && f.brands[0].count === 1);
    report("Audience options have counts", f.audiences.length === 3 && f.audiences.every((a) => a.count === 1));

    // ----- Suggestions -----
    const s = await querySuggestions("kestrel", "en");
    report("Suggestions: best match first, at most 6", s.products.length === 2 && s.products[0]?.slug === p1.slug && s.products.length <= 6);
    const sc = await querySuggestions("check search", "en");
    report("Suggestions include matching categories", sc.categories.some((c) => c.slug === cat.slug));
  } finally {
    await db.product.deleteMany({ where: { slug: { startsWith: "check-" } } });
    await db.brand.deleteMany({ where: { slug: { startsWith: "check-" } } });
    await db.category.deleteMany({ where: { slug: { startsWith: "check-" } } });
  }

  // ---------- The real pages and endpoint (needs the dev server and sample data) ----------
  try {
    const get = (path: string, ip = "203.0.113.9") =>
      fetch(`${BASE}${path}`, { redirect: "manual", headers: { "x-forwarded-for": ip } });

    const search = await get("/search?q=shirt");
    const searchHtml = await search.text();
    report("/search?q=shirt lists sample shirts", search.status === 200 && searchHtml.includes("Sample Linen Shirt"), `status ${search.status}`);
    report("Search pages are not indexed", /<meta[^>]*name="robots"[^>]*noindex/.test(searchHtml));

    const empty = await get("/search");
    report("/search without text shows the prompt", empty.status === 200 && (await empty.text()).includes("What are you looking for?"));

    const none = await get("/search?q=%25");
    report("A search for % shows 'No products found'", none.status === 200 && (await none.text()).includes("No products found"));

    const redirect = await get("/products?q=shirt");
    report(
      "/products?q=… redirects to the search page",
      (redirect.status >= 300 && redirect.status < 400 && (redirect.headers.get("location") ?? "").includes("/search")) ||
        (await redirect.text()).includes("__next-page-redirect"),
    );

    const api = await get("/api/search/suggestions?q=shirt");
    const body = (await api.json()) as { products?: { slug: string }[] };
    report(
      "Suggestions endpoint returns matches",
      api.status === 200 && Boolean(body.products?.some((p) => p.slug === "sample-linen-shirt")),
      `status ${api.status}`,
    );

    const short = (await (await get("/api/search/suggestions?q=a")).json()) as { products?: unknown[] };
    report("One character gives no suggestions", short.products?.length === 0);

    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    let blockedAt = 0;
    for (let i = 1; i <= 70; i++) {
      const res = await get("/api/search/suggestions?q=shirt", ip);
      await res.text();
      if (res.status === 429 && !blockedAt) blockedAt = i;
    }
    report("The suggestions endpoint is rate limited (60 per minute)", blockedAt === 61, blockedAt ? `blocked at ${blockedAt}` : "never blocked");
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