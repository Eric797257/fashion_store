import "dotenv/config";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`; // reserved test range
let failed = false;

async function check(provider: "google" | "facebook", expectedHost: string) {
  const res = await fetch(`${BASE}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
    body: JSON.stringify({ provider, callbackURL: "/account", additionalData: { locale: "en" } }),
  });

  if (!res.ok) {
    console.log(`ℹ️  ${provider}: not configured (status ${res.status}). The button stays hidden.`);
    return;
  }

  const body = (await res.json()) as { url?: string };
  if (!body.url) {
    console.log(`❌ ${provider}: no redirect URL returned`);
    failed = true;
    return;
  }

  const url = new URL(body.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const scope = url.searchParams.get("scope") ?? "";
  const hostOk = url.hostname.endsWith(expectedHost);
  const emailScope = scope.includes("email");

  console.log(`${hostOk && emailScope ? "✅" : "❌"} ${provider}: redirects to ${url.hostname}, scopes: ${scope}`);
  console.log(`   Register this redirect URI in the ${provider} console:`);
  console.log(`   ${redirectUri}`);
  if (!hostOk || !emailScope) failed = true;
}

async function main() {
  await check("google", "google.com");
  await check("facebook", "facebook.com");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Could not reach the dev server. Is `npm run dev` running?");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});