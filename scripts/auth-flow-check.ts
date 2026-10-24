import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`; // reserved test range
const email = `flow-${Date.now()}@example.test`;
const PW1 = "FlowTest123";
const PW2 = "FlowTest456";
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

function api(path: string, body: unknown) {
  return fetch(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function waitForLink(subjectPart: string, urlPart: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=100`)).json()) as {
      messages?: { ID: string; Subject: string; To: { Address: string }[] }[];
    };
    const match = list.messages?.find(
      (m) => m.Subject.includes(subjectPart) && m.To.some((t) => t.Address === email),
    );
    if (match) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as {
        Text?: string;
      };
      const links = msg.Text?.match(/https?:\/\/[^\s<>"]+/g) ?? [];
      return links.find((l) => l.includes(urlPart)) ?? null;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function followOnce(url: string) {
  return fetch(url, { redirect: "manual", headers: { "x-forwarded-for": ip } });
}

async function main() {
  const signUp = await api("/sign-up/email", {
    name: "Flow Test",
    email,
    password: PW1,
    locale: "en",
    callbackURL: `${BASE}/verify-email/complete`,
  });
  report("Sign-up accepted", signUp.status === 200, `status ${signUp.status}`);

  const early = await api("/sign-in/email", { email, password: PW1 });
  report("Sign-in blocked until email is verified", early.status === 403, `status ${early.status}`);

  const verifyLink = await waitForLink("Verify your email address", "verify-email");
  report("Verification email arrived in Mailpit", Boolean(verifyLink));
  if (!verifyLink) return;

  const verified = await followOnce(verifyLink);
  const verifiedTo = verified.headers.get("location") ?? "";
  report(
    "Verification link redirects to the success page",
    verified.status >= 300 && verified.status < 400 && verifiedTo.includes("/verify-email/complete") && !verifiedTo.includes("error="),
    verifiedTo,
  );

  const afterVerify = await api("/sign-in/email", { email, password: PW1 });
  report("Sign-in works after verification", afterVerify.status === 200, `status ${afterVerify.status}`);

  const forgot = await api("/request-password-reset", { email, redirectTo: `${BASE}/reset-password` });
  report("Password reset request accepted", forgot.status === 200, `status ${forgot.status}`);

  const resetLink = await waitForLink("Reset your password", "reset-password");
  report("Reset email arrived in Mailpit", Boolean(resetLink));
  if (!resetLink) return;

  const landed = await followOnce(resetLink);
  const landedTo = landed.headers.get("location") ?? "";
  const token = landedTo ? new URL(landedTo, BASE).searchParams.get("token") : null;
  report("Reset link redirects with a token", Boolean(token), landedTo ? "" : `status ${landed.status}`);
  if (!token) return;

  const weak = await api("/reset-password", { newPassword: "short", token });
  report("Weak new password rejected by the server", weak.status === 400, `status ${weak.status}`);

  const reset = await api("/reset-password", { newPassword: PW2, token });
  report("Password reset succeeds", reset.status === 200, `status ${reset.status}`);

  const changedMail = await waitForLink("Your password was changed", "forgot-password");
  report("'Password changed' notice email arrived", Boolean(changedMail));

  const oldPw = await api("/sign-in/email", { email, password: PW1 });
  report("Old password no longer works", oldPw.status === 401 || oldPw.status === 400, `status ${oldPw.status}`);

  const newPw = await api("/sign-in/email", { email, password: PW2 });
  report("New password works", newPw.status === 200, `status ${newPw.status}`);

  const reuse = await api("/reset-password", { newPassword: "AnotherPass789", token });
  report("Reset link cannot be reused", reuse.status >= 400 && reuse.status < 500, `status ${reuse.status}`);

  const dup = await api("/sign-up/email", { name: "Flow Test", email, password: PW2 });
  report("Duplicate sign-up gives the same generic success", dup.status === 200, `status ${dup.status}`);
  const dupMail = await waitForLink("Sign-up attempt with your email", "sign-in");
  report("Existing owner is notified of the duplicate sign-up", Boolean(dupMail));
}

main()
  .catch((err) => {
    console.error("❌ Flow check crashed. Are the dev server and Mailpit running?");
    console.error(err instanceof Error ? err.message : err);
    failed = true;
  })
  .finally(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  });