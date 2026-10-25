import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ROLE_DEFINITIONS, ROLE_KEYS } from "../src/server/permissions/catalog";
import {
  canAccessOwned,
  canAssignRank,
  canManageRank,
  hasPermission,
  twoFactorSatisfied,
} from "../src/server/permissions/policy";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PW = "RbacTest123";
const stamp = Date.now();
const userEmail = `rbac-${stamp}@example.test`;
const lockEmail = `lock-${stamp}@example.test`;
const ghostEmail = `ghost-${stamp}@example.test`;
let failed = false;

const randomIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`; // reserved test range

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

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

async function api(path: string, body: unknown, jar: Jar, ip: string) {
  const res = await fetch(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body: JSON.stringify(body),
  });
  jar.absorb(res);
  await res.text();
  return { status: res.status };
}

/** What a browser would experience when opening a page. */
async function outcome(path: string, jar?: Jar): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { cookie: jar?.header() ?? "", "x-forwarded-for": randomIp() },
  });

  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    return `redirect:${new URL(location, BASE).pathname}`;
  }

  const text = await res.text();

  // A redirect that Next.js had to send after the page started streaming
  const redirectTag = text.match(/<meta[^>]*__next-page-redirect[^>]*>/)?.[0];
  const redirectUrl = redirectTag?.match(/url=([^"']+)/)?.[1];
  if (redirectUrl) return `redirect:${new URL(redirectUrl.replace(/&amp;/g, "&"), BASE).pathname}`;

  // A real 404, or one signalled after streaming started
  const errorTag = text.match(/<meta[^>]*name="next-error"[^>]*>/)?.[0] ?? "";
  if (res.status === 404 || errorTag.includes("not-found")) return "notfound";

  return res.status === 200 ? "ok" : `status:${res.status}`;
}

async function apiAccessStatus(jar?: Jar): Promise<number> {
  const res = await fetch(`${BASE}/api/admin/access`, {
    headers: { cookie: jar?.header() ?? "", "x-forwarded-for": randomIp() },
  });
  await res.text();
  return res.status;
}

async function createVerifiedUser(email: string) {
  await api("/sign-up/email", { name: "Rbac Test", email, password: PW }, new Jar(), randomIp());
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
}

async function lockoutRound(label: string, email: string, realPassword: string | null) {
  const statuses: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = await api("/sign-in/email", { email, password: "WrongPass999" }, new Jar(), randomIp());
    statuses.push(r.status);
  }
  report(`${label}: 10 wrong attempts are answered normally`, statuses.every((s) => s === 401), statuses.join(","));

  const eleventh = await api(
    "/sign-in/email",
    { email, password: realPassword ?? "WrongPass999" },
    new Jar(),
    randomIp(),
  );
  report(`${label}: the 11th attempt is blocked`, eleventh.status === 429, `status ${eleventh.status}`);
}

async function main() {
  // ---------- A. Permission matrix in the database ----------
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });
  for (const key of ROLE_KEYS) {
    const row = roles.find((r) => r.key === key);
    const have = new Set(row?.permissions.map((p) => p.permission.key) ?? []);
    const want = new Set<string>(ROLE_DEFINITIONS[key].permissions);
    const missing = [...want].filter((k) => !have.has(k));
    const extra = [...have].filter((k) => !want.has(k));
    report(
      `${key} has exactly the default permissions`,
      Boolean(row) && missing.length === 0 && extra.length === 0,
      missing.length || extra.length ? `missing: ${missing.join(",")} extra: ${extra.join(",")}` : `${have.size}`,
    );
  }

  const rank = (k: string) => roles.find((r) => r.key === k)?.rank ?? -1;
  report(
    "Ranks are ordered SUPER_ADMIN > ADMIN > STAFF > RIDER > CUSTOMER",
    rank("SUPER_ADMIN") > rank("ADMIN") &&
      rank("ADMIN") > rank("STAFF") &&
      rank("STAFF") > rank("RIDER") &&
      rank("RIDER") > rank("CUSTOMER"),
  );

  // ---------- B. Pure rules ----------
  const staff = { userId: "u1", permissions: new Set<string>(ROLE_DEFINITIONS.STAFF.permissions) };
  report("STAFF can process orders", hasPermission(staff, "order.process"));
  report("STAFF cannot manage staff accounts or roles", !hasPermission(staff, "staff.manage") && !hasPermission(staff, "role.manage"));
  report("No access object means no permission", !hasPermission(null, "order.read"));
  report("ADMIN cannot manage or create another ADMIN or SUPER_ADMIN", !canManageRank(80, 80) && !canManageRank(80, 100) && !canAssignRank(80, 80));
  report("SUPER_ADMIN can manage ADMIN, but not another SUPER_ADMIN", canManageRank(100, 80) && !canManageRank(100, 100));
  const customer = { userId: "c1", permissions: new Set<string>() };
  report(
    "A customer reaches their own order but not someone else's",
    canAccessOwned(customer, "c1", "order.read") && !canAccessOwned(customer, "c2", "order.read"),
  );
  report(
    "Staff-level roles need 2FA, customers do not",
    !twoFactorSatisfied({ role: "STAFF", twoFactorEnabled: false }) &&
      twoFactorSatisfied({ role: "STAFF", twoFactorEnabled: true }) &&
      twoFactorSatisfied({ role: "CUSTOMER", twoFactorEnabled: false }),
  );

  // ---------- C. Real requests to protected pages and the API ----------
  report("Anonymous visitor is sent to sign-in from /admin", (await outcome("/admin")) === "redirect:/sign-in");
  report("Anonymous visitor is sent to sign-in from /rider", (await outcome("/rider")) === "redirect:/sign-in");
  report("Anonymous API call gets 401", (await apiAccessStatus()) === 401);

  await createVerifiedUser(userEmail);
  const jar = new Jar();
  const signIn = await api("/sign-in/email", { email: userEmail, password: PW }, jar, randomIp());
  report("Test customer signed in", signIn.status === 200, `status ${signIn.status}`);

  report("CUSTOMER gets a 404 for /admin", (await outcome("/admin", jar)) === "notfound");
  report("CUSTOMER gets 403 from the admin API", (await apiAccessStatus(jar)) === 403);

  await prisma.user.update({ where: { email: userEmail }, data: { role: "STAFF", twoFactorEnabled: false } });
  report("STAFF without 2FA is sent to the security page", (await outcome("/admin", jar)) === "redirect:/account/security");
  report("STAFF without 2FA gets 403 from the admin API", (await apiAccessStatus(jar)) === 403);

  await prisma.user.update({ where: { email: userEmail }, data: { twoFactorEnabled: true } });
  report("STAFF with 2FA can open /admin", (await outcome("/admin", jar)) === "ok");
  report("STAFF with 2FA gets 200 from the admin API", (await apiAccessStatus(jar)) === 200);
  report("STAFF gets a 404 for /rider (no rider permission)", (await outcome("/rider", jar)) === "notfound");

  await prisma.user.update({ where: { email: userEmail }, data: { role: "RIDER" } });
  report("RIDER with 2FA can open /rider", (await outcome("/rider", jar)) === "ok");
  report("RIDER gets a 404 for /admin", (await outcome("/admin", jar)) === "notfound");

  await prisma.user.update({ where: { email: userEmail }, data: { role: "CUSTOMER" } });
  report("Demoting to CUSTOMER takes effect on the very next request", (await outcome("/admin", jar)) === "notfound");

  // ---------- D. Per-account lockout ----------
  await createVerifiedUser(lockEmail);
  await lockoutRound("Real account", lockEmail, PW);
  await lockoutRound("Unknown email", ghostEmail, null);
}

main()
  .catch((err) => {
    console.error("❌ Check crashed. Is the dev server running?");
    console.error(err instanceof Error ? err.message : err);
    failed = true;
  })
  .finally(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [userEmail, lockEmail] } } });
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "acct-login:" } } });
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  });