import "dotenv/config";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
let failed = false;

// 203.0.113.0/24 is a reserved documentation range, never a real visitor
const testIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

function post(path: string, body: unknown, ip: string) {
  return fetch(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

async function main() {
  // 1) Weak password is rejected by the SERVER, not just the form
  const weak = await post(
    "/sign-up/email",
    { name: "Check User", email: `check-${Date.now()}@example.test`, password: "short" },
    testIp(),
  );
  report("Weak password rejected on the server", weak.status === 400, `status ${weak.status}`);

  // 2) Invalid email rejected
  const badEmail = await post("/sign-in/email", { email: "not-an-email", password: "x" }, testIp());
  report("Invalid email rejected on the server", badEmail.status === 400, `status ${badEmail.status}`);

  // 3) Wrong credentials give a generic failure
  const wrong = await post(
    "/sign-in/email",
    { email: "nobody@example.test", password: "WrongPass123" },
    testIp(),
  );
  report(
    "Unknown account rejected",
    wrong.status === 401 || wrong.status === 400,
    `status ${wrong.status}`,
  );

  // 4) Rate limit: 10 sign-ins per minute are allowed, the 11th must be blocked
  const ip = testIp();
  let firstBlocked = 0;
  for (let i = 1; i <= 13; i++) {
    const res = await post("/sign-in/email", { email: "nobody@example.test", password: "WrongPass123" }, ip);
    if (res.status === 429 && firstBlocked === 0) firstBlocked = i;
  }
  report(
    "Sign-in rate limit blocks the 11th attempt",
    firstBlocked === 11,
    firstBlocked ? `first blocked at attempt ${firstBlocked}` : "never blocked",
  );

  // 5) Password-reset requests are rate limited too (10 per hour, so the 11th is blocked)
  const resetIp = testIp();
  let resetBlocked = 0;
  for (let i = 1; i <= 13; i++) {
    const res = await post(
      "/request-password-reset",
      { email: "nobody@example.test", redirectTo: `${BASE}/reset-password` },
      resetIp,
    );
    if (res.status === 429 && resetBlocked === 0) resetBlocked = i;
  }
  report(
    "Password-reset request rate limit blocks the 11th attempt",
    resetBlocked === 11,
    resetBlocked ? `first blocked at attempt ${resetBlocked}` : "never blocked",
  );

  // 6) Weak password on reset is rejected by the server
  const weakReset = await post("/reset-password", { newPassword: "abc", token: "x" }, testIp());
  report("Weak password on reset rejected by the server", weakReset.status === 400, `status ${weakReset.status}`);

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Could not reach the dev server. Is `npm run dev` running?");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});