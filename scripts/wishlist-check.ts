import "dotenv/config";
import { db } from "../src/lib/db";
import { queryWishlistItems, queryWishlistProductIds } from "../src/server/wishlist/read";
import { MAX_WISHLIST_ITEMS, setWishlistedForUser } from "../src/server/wishlist/service";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const PW = "WishTest123";
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`; // reserved test range

class Jar {
  private cookies = new Map<string, string>();
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(";")[0] ?? "";
      const idx = pair.indexOf("=");
      if (idx < 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

async function authPost(path: string, body: unknown, jar: Jar) {
  const res = await fetch(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": randomIp(), cookie: jar.header() },
    body: JSON.stringify(body),
  });
  jar.absorb(res);
  await res.text();
  return res.status;
}

async function main() {
  const cat = await db.category.create({ data: { name: "Check Wish", slug: `check-wish-${stamp}` } });

  const mk = (key: string, status: "ACTIVE" | "DRAFT" = "ACTIVE") =>
    db.product.create({
      data: {
        slug: `check-wish-${key}-${stamp}`, name: `Wish ${key}`, categoryId: cat.id, status,
        publishedAt: new Date(), price: 15000,
        variants: { create: [{ sku: `CHECK-WISH-${key}-${stamp}`.toUpperCase(), size: "M", color: "Black", stockOnHand: 3 }] },
      },
    });

  const mkUser = (label: string) =>
    db.user.create({
      data: { id: `check-wish-${label}-${stamp}`, name: `Wish ${label}`, email: `check-wish-${label}-${stamp}@example.test`, emailVerified: true },
    });

  try {
    const [a, b, e, f] = await Promise.all([mk("a"), mk("b"), mk("e"), mk("f")]);
    const draft = await mk("draft", "DRAFT");
    const userA = await mkUser("a");
    const userB = await mkUser("b");

    // ---------- Basics ----------
    const r1 = await setWishlistedForUser(userA.id, a.id, true);
    report("Saving a product works", r1.ok && r1.wishlisted && (await queryWishlistProductIds(userA.id)).join() === a.id);

    await setWishlistedForUser(userA.id, a.id, true);
    const rows = await db.wishlistItem.count({ where: { productId: a.id, wishlist: { userId: userA.id } } });
    report("Saving the same product again changes nothing", rows === 1, `${rows} row(s)`);

    const rDraft = await setWishlistedForUser(userA.id, draft.id, true);
    report("A draft product cannot be saved", !rDraft.ok && rDraft.error === "NOT_FOUND");
    const rGhost = await setWishlistedForUser(userA.id, "does-not-exist", true);
    report("An unknown product cannot be saved", !rGhost.ok && rGhost.error === "NOT_FOUND");

    await wait(10);
    await setWishlistedForUser(userA.id, b.id, true);
    report("Newest saved product comes first", (await queryWishlistProductIds(userA.id)).join() === `${b.id},${a.id}`);

    // ---------- Ownership ----------
    report("Another customer sees nothing of it", (await queryWishlistProductIds(userB.id)).length === 0);
    await setWishlistedForUser(userB.id, a.id, false);
    report("Another customer cannot remove it either", (await queryWishlistProductIds(userA.id)).length === 2);

    // ---------- Removing ----------
    await setWishlistedForUser(userA.id, a.id, false);
    report("Removing works", (await queryWishlistProductIds(userA.id)).join() === b.id);
    const again = await setWishlistedForUser(userA.id, a.id, false);
    report("Removing something that is not saved is harmless", again.ok && !again.wishlisted);

    // ---------- Parallel requests ----------
    let parallelOk = true;
    try {
      await Promise.all(Array.from({ length: 6 }, () => setWishlistedForUser(userA.id, a.id, true)));
    } catch {
      parallelOk = false;
    }
    const dupes = await db.wishlistItem.count({ where: { productId: a.id, wishlist: { userId: userA.id } } });
    report("Six parallel saves of one product: no error, no duplicate", parallelOk && dupes === 1, `${dupes} row(s)`);

    const userC = await mkUser("c");
    let firstOk = true;
    try {
      await Promise.all([a, b, e, f].map((p) => setWishlistedForUser(userC.id, p.id, true)));
    } catch {
      firstOk = false;
    }
    const lists = await db.wishlist.count({ where: { userId: userC.id } });
    const items = await db.wishlistItem.count({ where: { wishlist: { userId: userC.id } } });
    report("A new customer saving 4 products at once gets exactly one wishlist", firstOk && lists === 1 && items === 4, `${lists} list, ${items} items`);

    // ---------- Products that stop being sold ----------
    await db.product.update({ where: { id: b.id }, data: { status: "DRAFT" } });
    const ids = await queryWishlistProductIds(userA.id);
    const page = await queryWishlistItems(userA.id, "en");
    report(
      "A product that is no longer sold leaves the count and moves to 'unavailable'",
      !ids.includes(b.id) && page.unavailable.some((u) => u.productId === b.id && u.name === "Wish b") && !page.items.some((i) => i.id === b.id),
    );
    await db.product.update({ where: { id: b.id }, data: { status: "ACTIVE" } });

    const card = (await queryWishlistItems(userA.id, "en")).items.find((i) => i.id === a.id);
    report("Wishlist page cards carry live data", card?.name === "Wish a" && card.price === 15000 && card.stockStatus !== "OUT_OF_STOCK");

    // ---------- The 200 limit ----------
    const userD = await mkUser("d");
    const bulk = Array.from({ length: MAX_WISHLIST_ITEMS + 1 }, (_, i) => ({
      id: `check-wish-bulk-${i}-${stamp}`, slug: `check-wish-bulk-${i}-${stamp}`, name: `Bulk ${i}`,
      categoryId: cat.id, status: "ACTIVE" as const, price: 1000,
    }));
    await db.product.createMany({ data: bulk });
    const listD = await db.wishlist.create({ data: { userId: userD.id }, select: { id: true } });
    await db.wishlistItem.createMany({
      data: bulk.slice(0, MAX_WISHLIST_ITEMS).map((p) => ({ wishlistId: listD.id, productId: p.id })),
    });
    const over = await setWishlistedForUser(userD.id, bulk[MAX_WISHLIST_ITEMS]!.id, true);
    report("The 201st item is refused", !over.ok && over.error === "LIMIT");
    await setWishlistedForUser(userD.id, bulk[0]!.id, false);
    const fits = await setWishlistedForUser(userD.id, bulk[MAX_WISHLIST_ITEMS]!.id, true);
    report("After removing one, a new item fits", fits.ok);

    // ---------- Deleting a customer deletes their wishlist ----------
    await db.user.delete({ where: { id: userC.id } });
    const orphans =
      (await db.wishlist.count({ where: { userId: userC.id } })) +
      (await db.wishlistItem.count({ where: { wishlist: { userId: userC.id } } }));
    report("Deleting a customer removes their wishlist", orphans === 0);

    // ---------- Real pages (needs the dev server) ----------
    let serverUp = true;
    try {
      await fetch(BASE, { method: "HEAD" });
    } catch {
      serverUp = false;
    }

    if (!serverUp) {
      console.log("ℹ️  Dev server not reachable. Skipped the page checks.");
    } else {
      const signedIn = async (label: string) => {
        const email = `check-wish-${label}-${stamp}@example.test`;
        const jar = new Jar();
        await authPost("/sign-up/email", { name: `Wish ${label}`, email, password: PW }, new Jar());
        await db.user.update({ where: { email }, data: { emailVerified: true } });
        const status = await authPost("/sign-in/email", { email, password: PW }, jar);
        const user = await db.user.findUnique({ where: { email }, select: { id: true } });
        return { jar, id: user?.id ?? "", status };
      };

      const alice = await signedIn("alice");
      const bob = await signedIn("bob");
      report("Two real customers signed in", alice.status === 200 && bob.status === 200 && Boolean(alice.id) && Boolean(bob.id));

      await setWishlistedForUser(alice.id, a.id, true);

      const get = (path: string, jar?: Jar) =>
        fetch(`${BASE}${path}`, { redirect: "manual", headers: { cookie: jar?.header() ?? "", "x-forwarded-for": randomIp() } });

      const anon = await get("/account/wishlist");
      const anonHtml = await anon.text();
      report(
        "A visitor who is not signed in is sent to sign in",
        (anon.status >= 300 && anon.status < 400 && (anon.headers.get("location") ?? "").includes("/sign-in")) ||
        anonHtml.includes("__next-page-redirect"),
      );

      const mine = await get("/account/wishlist", alice.jar);
      const mineHtml = await mine.text();
      report("A customer sees their own saved product", mine.status === 200 && mineHtml.includes("Wish a"), `status ${mine.status}`);
      report("The header shows the real count", mineHtml.includes("Wishlist (1)"));

      const theirs = await get("/account/wishlist", bob.jar);
      const theirsHtml = await theirs.text();
      report("Another customer does not see it", theirs.status === 200 && !theirsHtml.includes("Wish a") && theirsHtml.includes("Your wishlist is empty"));

      const product = await get(`/products/check-wish-a-${stamp}`);
      const productHtml = await product.text();
      const title = productHtml.match(/<title>([^<]*)<\/title>/)?.[1] ?? "no title";
      report(
        "The product page has a working Save to wishlist button",
        product.status === 200 &&
        /<button[^>]*aria-pressed="false"[^>]*>(?:(?!<\/button>)[\s\S])*Save to wishlist/.test(productHtml),
        `status ${product.status}, title: ${title}`,
      );
    }
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: "check-wish-" } } });
    await db.product.deleteMany({ where: { slug: { startsWith: "check-wish-" } } });
    await db.category.deleteMany({ where: { slug: { startsWith: "check-wish-" } } });
  }

  const left =
    (await db.user.count({ where: { email: { startsWith: "check-wish-" } } })) +
    (await db.product.count({ where: { slug: { startsWith: "check-wish-" } } }));
  report("No test data left behind", left === 0);
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