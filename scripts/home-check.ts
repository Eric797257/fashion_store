import "dotenv/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SimpleContent } from "../src/components/content/simple-content";
import { db } from "../src/lib/db";
import { parseSimpleContent } from "../src/lib/simple-content";
import { queryBanners, queryTestimonials } from "../src/server/catalog/home-query";
import { queryShelf } from "../src/server/catalog/listing-query";
import {
  confirmByToken,
  hashToken,
  requestSubscription,
  unsubscribeByToken,
} from "../src/server/newsletter/service";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const PREFIX = `check-home-${stamp}`;
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

const DAY = 24 * 60 * 60 * 1000;

async function rejected(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  // ---------- Safe text format ----------
  const sample = "## Title\nIntro line\nsecond line\n\n- a\n- b\n\n<script>alert(1)</script>";
  const blocks = parseSimpleContent(sample);
  report(
    "Text format: heading, paragraph, list, and HTML stays plain text",
    blocks.length === 4 &&
      blocks[0]?.type === "heading" &&
      blocks[1]?.type === "paragraph" &&
      blocks[2]?.type === "list" &&
      blocks[3]?.type === "paragraph",
  );
  const html = renderToStaticMarkup(createElement(SimpleContent, { text: sample }));
  report(
    "A script in page text is shown as text and never runs",
    html.includes("&lt;script&gt;") && !html.includes("<script>"),
  );
  report("Control characters are removed", !parseSimpleContent("a\u0000b").some((b) => b.type === "paragraph" && b.text.includes("\u0000")));

  // ---------- Banners ----------
  const mkBanner = (key: string, over: Record<string, unknown> = {}) =>
    db.banner.create({
      data: {
        placement: "PROMO", title: `${PREFIX}-${key}`, ctaHref: "/products", sortOrder: 900, ...over,
      } as Parameters<typeof db.banner.create>[0]["data"],
    });

  await mkBanner("active");
  await mkBanner("inactive", { isActive: false });
  await mkBanner("future", { startsAt: new Date(Date.now() + DAY) });
  await mkBanner("expired", { startsAt: new Date(Date.now() - 3 * DAY), endsAt: new Date(Date.now() - DAY) });
  await mkBanner("windowed", { startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) });
  await mkBanner("hero", { placement: "HERO", title: `${PREFIX}-hero` });

  const banners = await queryBanners("en");
  const promoNames = banners.promo.map((b) => b.title.replace(`${PREFIX}-`, "")).filter((t) => !t.includes("Shop"));
  report(
    "Only active banners inside their schedule are shown",
    promoNames.includes("active") && promoNames.includes("windowed") &&
      !promoNames.includes("inactive") && !promoNames.includes("future") && !promoNames.includes("expired"),
    promoNames.join(","),
  );
  report("Hero and promo banners are separated", banners.hero.some((b) => b.title.endsWith("-hero")) && !banners.promo.some((b) => b.title.endsWith("-hero")));

  report("A banner link to another website is refused by the database", await rejected(() => mkBanner("evil1", { ctaHref: "https://evil.example" })));
  report("A protocol-relative banner link (//host) is refused", await rejected(() => mkBanner("evil2", { ctaHref: "//evil.example" })));
  report("A backslash banner link is refused", await rejected(() => mkBanner("evil3", { ctaHref: "/\\evil.example" })));
  report("A banner whose end is before its start is refused", await rejected(() => mkBanner("backwards", { startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() - DAY) })));
  report("Internal banner links are accepted", !(await rejected(() => mkBanner("fine", { ctaHref: "/categories/women?sort=popular" }))));

  // ---------- Testimonials ----------
  await db.testimonial.create({ data: { authorName: `${PREFIX}-on`, quote: "Good", sortOrder: 900 } });
  await db.testimonial.create({ data: { authorName: `${PREFIX}-off`, quote: "Hidden", isActive: false } });
  const testimonials = await queryTestimonials("en");
  report("Only active testimonials are shown", testimonials.some((t) => t.author.endsWith("-on")) && !testimonials.some((t) => t.author.endsWith("-off")));
  report("A rating outside 1 to 5 is refused", await rejected(() => db.testimonial.create({ data: { authorName: `${PREFIX}-bad`, quote: "x", rating: 6 } })));

  // ---------- Homepage shelves ----------
  const cat = await db.category.create({ data: { name: "Check Home", slug: PREFIX } });
  const mkProduct = (key: string, over: Record<string, unknown> = {}, stock = 3) =>
    db.product.create({
      data: {
        slug: `${PREFIX}-${key}`, name: `Home ${key}`, categoryId: cat.id, status: "ACTIVE",
        publishedAt: new Date(), price: 40000,
        variants: { create: [{ sku: `${PREFIX}-${key}`.toUpperCase(), size: "M", color: "Black", stockOnHand: stock }] },
        ...over,
      } as Parameters<typeof db.product.create>[0]["data"],
    });

  const fa = await mkProduct("fa", { isFeatured: true });
  const fb = await mkProduct("fb", { isFeatured: true }, 0);
  const fc = await mkProduct("fc", { isFeatured: true, status: "DRAFT" });
  const sa = await mkProduct("sa", { salePrice: 30000 });
  const sb = await mkProduct("sb", { salePrice: 30000, saleStartsAt: new Date(Date.now() - 3 * DAY), saleEndsAt: new Date(Date.now() - DAY) });
  const bs = await mkProduct("bs", { soldCount: 99999 });
  const bz = await mkProduct("bz", { soldCount: 0 });

  const ids = async (shelf: "featured" | "new" | "best" | "sale", limit = 60) =>
    (await queryShelf(shelf, limit, "en")).map((c) => c.id);

  const featured = await ids("featured");
  report("Featured shelf: flagged and in stock only (no sold-out, no draft)", featured.includes(fa.id) && !featured.includes(fb.id) && !featured.includes(fc.id));

  const sale = await queryShelf("sale", 60, "en");
  report("Offers shelf: active sales only, with the sale price shown", sale.some((c) => c.id === sa.id && c.price === 30000 && c.onSale) && !sale.some((c) => c.id === sb.id));

  const best = await queryShelf("best", 60, "en");
  report("Best sellers: top seller first, products with no sales excluded", best[0]?.id === bs.id && !best.some((c) => c.id === bz.id));

  report("A shelf never returns more than its limit", (await queryShelf("new", 3, "en")).length <= 3);

  const newest = await ids("new");
  report("New arrivals shelf contains new in-stock products but not sold-out ones", newest.includes(fa.id) && !newest.includes(fb.id));

  // ---------- Newsletter ----------
  const email = `${PREFIX}-Person@Example.Test`;
  const lower = email.toLowerCase();

  const first = await requestSubscription(email, "en");
  let row = await db.newsletterSubscriber.findUnique({ where: { email: lower } });
  report(
    "Subscribing stores the address in lowercase as pending, with only a hash of the token",
    Boolean(first.confirmToken) && row?.status === "PENDING" && row.confirmTokenHash === hashToken(first.confirmToken ?? "") && row.confirmTokenHash !== first.confirmToken,
  );

  const again = await requestSubscription(email, "en");
  report("A second request within a minute sends nothing new", again.confirmToken === null);

  report("A wrong token does not confirm", (await confirmByToken("x".repeat(43))) === "INVALID");

  report("The emailed token confirms", (await confirmByToken(first.confirmToken ?? "")) === "CONFIRMED");
  row = await db.newsletterSubscriber.findUnique({ where: { email: lower } });
  report("The subscriber is now SUBSCRIBED with a confirmation time", row?.status === "SUBSCRIBED" && row.confirmedAt !== null);

  report("Using the link again says it is already confirmed", (await confirmByToken(first.confirmToken ?? "")) === "ALREADY");
  report("Subscribing an already-subscribed address sends nothing", (await requestSubscription(email, "en")).confirmToken === null);

  report("An unknown unsubscribe token does nothing", (await unsubscribeByToken("y".repeat(43))) === false);
  report("Unsubscribing works and is safe to repeat", (await unsubscribeByToken(row?.unsubscribeToken ?? "")) === true && (await unsubscribeByToken(row?.unsubscribeToken ?? "")) === true);
  row = await db.newsletterSubscriber.findUnique({ where: { email: lower } });
  report("The subscriber is now UNSUBSCRIBED and old confirmation links are dead", row?.status === "UNSUBSCRIBED" && row.confirmTokenHash === null);

  const resub = await requestSubscription(email, "my");
  report("Someone who unsubscribed can subscribe again (new confirmation needed)", Boolean(resub.confirmToken));

  await db.newsletterSubscriber.update({ where: { email: lower }, data: { confirmExpiresAt: new Date(Date.now() - 1000) } });
  report("An expired confirmation link is refused", (await confirmByToken(resub.confirmToken ?? "")) === "INVALID");

  report("The database refuses an uppercase address", await rejected(() => db.newsletterSubscriber.create({ data: { email: `${PREFIX}-UPPER@example.test`, unsubscribeToken: `${PREFIX}-tok` } })));

  // ---------- The real pages (needs the dev server and the sample data) ----------
  try {
    const get = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { "x-forwarded-for": "203.0.113.9" } });
    const heading = (html: string, level: number, text: string) =>
      new RegExp(`<h${level}[^>]*>\\s*${text}\\s*</h${level}>`).test(html);

    const home = await get("/");
    const homeHtml = await home.text();
    report("The homepage opens", home.status === 200, `status ${home.status}`);
    report("Homepage: hero banner from the database", heading(homeHtml, 1, "New season, new favourites"));
    report("Homepage: shelves, testimonials and newsletter are present",
      heading(homeHtml, 2, "New arrivals") && heading(homeHtml, 2, "What customers say") && heading(homeHtml, 2, "Stay in the loop"));
    report("Homepage: has WebSite structured data with a search action", homeHtml.includes('"@type":"WebSite"') && homeHtml.includes("search_term_string"));

    const privacy = await get("/privacy-policy");
    const privacyHtml = await privacy.text();
    report("Privacy policy opens with its deletion instructions", privacy.status === 200 && heading(privacyHtml, 1, "Privacy policy") && heading(privacyHtml, 2, "Deleting your account and data"));

    const about = await get("/about");
    report("About page opens", about.status === 200 && heading(await about.text(), 1, "About us"));

    const contact = await get("/contact");
    const contactHtml = await contact.text();
    report("Contact page shows phone and email links", contact.status === 200 && contactHtml.includes('href="tel:') && contactHtml.includes('href="mailto:'));

    const unknown = await get("/not-a-real-page");
    const unknownHtml = await unknown.text();
    report("An unknown address is a 404", unknown.status === 404 || /<meta[^>]*name="next-error"[^>]*not-found/.test(unknownHtml), `status ${unknown.status}`);

    const confirm = await get("/newsletter/confirm?token=bad");
    report("The confirm page asks for a button press (no automatic subscribing)", confirm.status === 200 && (await confirm.text()).includes("Confirm subscription"));

    const robots = await (await get("/robots.txt")).text();
    const open = BASE.startsWith("https://");
    report(
      "robots.txt matches the environment",
      robots.includes("Sitemap:") && (open ? robots.includes("Disallow: /admin") : robots.includes("Disallow: /")),
      open ? "https site" : "local site: crawling disallowed",
    );

    const sitemap = await (await get("/sitemap.xml")).text();
    report(
      "sitemap.xml lists products, categories and pages but nothing private",
      sitemap.includes(`${BASE}/products/sample-linen-shirt`) && sitemap.includes(`${BASE}/categories/women`) && sitemap.includes(`${BASE}/privacy-policy`) &&
        !sitemap.includes("/admin") && !sitemap.includes("/account") && !sitemap.includes(`${PREFIX}-draft`),
    );
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
    await db.banner.deleteMany({ where: { title: { startsWith: "check-home-" } } });
    await db.testimonial.deleteMany({ where: { authorName: { startsWith: "check-home-" } } });
    await db.newsletterSubscriber.deleteMany({ where: { email: { startsWith: "check-home-" } } });
    await db.product.deleteMany({ where: { slug: { startsWith: "check-home-" } } });
    await db.category.deleteMany({ where: { slug: { startsWith: "check-home-" } } });
    await db.$disconnect();
    process.exit(failed ? 1 : 0);
  });