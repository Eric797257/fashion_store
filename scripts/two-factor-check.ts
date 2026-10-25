import "dotenv/config";
import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const email = `tf-${Date.now()}@example.test`;
const PW = "TwoFactor123";
let failed = false;

// ---- tiny helpers ----
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
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
        json = JSON.parse(text) as Record<string, unknown>;
    } catch {
        json = {};
    }
    return { status: res.status, json };
}

async function hasSession(jar: Jar, ip: string) {
    const res = await fetch(`${BASE}/api/auth/get-session`, {
        headers: { cookie: jar.header(), "x-forwarded-for": ip },
    });
    const text = await res.text();
    return text !== "null" && text.includes(email);
}

function report(name: string, ok: boolean, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
    if (!ok) failed = true;
}

// ---- authenticator code generator (RFC 6238, same as a phone app) ----
function base32Decode(input: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const ch of input.replace(/=+$/, "").toUpperCase()) {
        const v = alphabet.indexOf(ch);
        if (v >= 0) bits += v.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
}

function totp(secret: string, atMs = Date.now()): string {
    const counter = Math.floor(atMs / 1000 / 30);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hash = createHmac("sha1", base32Decode(secret)).update(buf).digest();
    const offset = (hash[hash.length - 1] ?? 0) & 0xf;
    const bin =
        (((hash[offset] ?? 0) & 0x7f) << 24) |
        (((hash[offset + 1] ?? 0) & 0xff) << 16) |
        (((hash[offset + 2] ?? 0) & 0xff) << 8) |
        ((hash[offset + 3] ?? 0) & 0xff);
    return String(bin % 1_000_000).padStart(6, "0");
}

const wrongCode = (valid: string) => String((Number(valid) + 1) % 1_000_000).padStart(6, "0");

async function waitForEmailCode(): Promise<string | null> {
    for (let i = 0; i < 20; i++) {
        const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=100`)).json()) as {
            messages?: { ID: string; Subject: string; To: { Address: string }[] }[];
        };
        const match = list.messages?.find(
            (m) => m.Subject.includes("Your sign-in code") && m.To.some((t) => t.Address === email),
        );
        if (match) {
            const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as {
                Text?: string;
            };
            return msg.Text?.match(/\b(\d{6})\b/)?.[1] ?? null;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return null;
}

async function countCodeEmails(): Promise<number> {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=200`)).json()) as {
        messages?: { Subject: string; To: { Address: string }[] }[];
    };
    return (
        list.messages?.filter(
            (m) => m.Subject.includes("Your sign-in code") && m.To.some((t) => t.Address === email),
        ).length ?? 0
    );
}

/** Audit rows can land a moment after the response, so wait up to 5 seconds for one. */
async function waitForAudit(userId: string | undefined, action: string): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
        const row = await prisma.auditLog.findFirst({ where: { entityId: userId, action } });
        if (row) return true;
        await new Promise((r) => setTimeout(r, 250));
    }
    return false;
}

async function auditActionsFor(userId: string | undefined): Promise<string> {
    const rows = await prisma.auditLog.findMany({
        where: { entityId: userId },
        select: { action: true },
        orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => r.action).join(", ") || "none";
}

/** Signs in with the password and returns a jar that holds the 2FA challenge cookie. */
async function startChallenge(ip: string) {
    const jar = new Jar();
    const res = await api("/sign-in/email", { email, password: PW }, jar, ip);
    return { jar, res };
}

async function main() {
    const setupIp = randomIp();

    // 1) Create a verified account and sign in
    await api("/sign-up/email", { name: "TF Test", email, password: PW }, new Jar(), setupIp);
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });

    const session = new Jar();
    const signedIn = await api("/sign-in/email", { email, password: PW }, session, setupIp);
    report("Sign-in works before 2FA", signedIn.status === 200 && (await hasSession(session, setupIp)));

    // 2) Wrong password cannot start enrollment
    const badPw = await api("/two-factor/enable", { password: "WrongPass999" }, session, setupIp);
    report("Enrollment refused with the wrong password", badPw.status >= 400 && badPw.status < 500, `status ${badPw.status}`);

    // 3) Enable: returns a TOTP URI and 10 backup codes
    const enable = await api("/two-factor/enable", { password: PW }, session, setupIp);
    const totpURI = String(enable.json.totpURI ?? "");
    const backupCodes = (enable.json.backupCodes as string[] | undefined) ?? [];
    const secret = totpURI ? (new URL(totpURI).searchParams.get("secret") ?? "") : "";
    report("Enable returns an authenticator key and 10 backup codes", Boolean(secret) && backupCodes.length === 10, `status ${enable.status}, codes ${backupCodes.length}`);
    if (!secret) return;

    // 4) 2FA must NOT be active until a code is verified
    let row = await prisma.user.findUnique({ where: { email }, select: { twoFactorEnabled: true } });
    report("2FA stays off until the first code is verified", row?.twoFactorEnabled !== true);

    // 5) Wrong code rejected, right code activates
    const nowCode = totp(secret);
    const badVerify = await api("/two-factor/verify-totp", { code: wrongCode(nowCode) }, session, setupIp);
    report("Wrong code rejected during enrollment", badVerify.status >= 400 && badVerify.status < 500, `status ${badVerify.status}`);

    const goodVerify = await api("/two-factor/verify-totp", { code: nowCode }, session, setupIp);
    row = await prisma.user.findUnique({ where: { email }, select: { twoFactorEnabled: true } });
    report("Correct code turns 2FA on", goodVerify.status === 200 && row?.twoFactorEnabled === true, `status ${goodVerify.status}`);

    const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const enabledOk = await waitForAudit(me?.id, "two_factor.enabled");
    report(
        "Turning 2FA on is written to the audit log",
        enabledOk,
        `rows: ${await auditActionsFor(me?.id)}`,
    );

    // 6) Server validation: a code that is not 6 digits is rejected before it is even checked
    const malformed = await api("/two-factor/verify-totp", { code: "12ab" }, session, setupIp);
    report("Malformed code rejected by the server", malformed.status === 400, `status ${malformed.status}`);

    // 7) Password sign-in now gives a challenge, not a session
    const ipA = randomIp();
    const a = await startChallenge(ipA);
    const methods = (a.res.json.twoFactorMethods as string[] | undefined) ?? [];
    report("Sign-in now returns a 2FA challenge", a.res.json.twoFactorRedirect === true && methods.includes("totp"), `methods: ${methods.join(", ") || "none"}`);
    report("No session exists before the second factor", !(await hasSession(a.jar, ipA)));

    // 8) Wrong code fails, correct code (next 30s window, so no replay) signs in
    const wrong = await api("/two-factor/verify-totp", { code: wrongCode(totp(secret)) }, a.jar, ipA);
    report("Wrong authenticator code rejected at sign-in", wrong.status >= 400 && wrong.status < 500, `status ${wrong.status}`);
    const right = await api("/two-factor/verify-totp", { code: totp(secret, Date.now() + 30_000) }, a.jar, ipA);
    report("Correct authenticator code completes sign-in", right.status === 200 && (await hasSession(a.jar, ipA)), `status ${right.status}`);

    // 9) Backup code works once
    const code0 = backupCodes[0] ?? "";
    const ipB = randomIp();
    const b = await startChallenge(ipB);
    const useBackup = await api("/two-factor/verify-backup-code", { code: code0 }, b.jar, ipB);
    report("Backup code completes sign-in", useBackup.status === 200 && (await hasSession(b.jar, ipB)), `status ${useBackup.status}`);

    const ipC = randomIp();
    const c = await startChallenge(ipC);
    const reuse = await api("/two-factor/verify-backup-code", { code: code0 }, c.jar, ipC);
    report("The same backup code cannot be used twice", reuse.status >= 400 && reuse.status < 500, `status ${reuse.status}`);

    // 10) Email code (a separate method from the authenticator app)
    const ipD = randomIp();
    const d = await startChallenge(ipD);
    const send = await api("/two-factor/send-otp", {}, d.jar, ipD);
    const emailed = await waitForEmailCode();
    report("Email code is sent to the account's inbox", send.status === 200 && Boolean(emailed), `status ${send.status}`);
    if (emailed) {
        const viaOtp = await api("/two-factor/verify-otp", { code: emailed }, d.jar, ipD);
        report("Email code completes sign-in", viaOtp.status === 200 && (await hasSession(d.jar, ipD)), `status ${viaOtp.status}`);
    }

    // 11) Staff accounts must never be emailed a code
    await prisma.user.update({ where: { email }, data: { role: "STAFF" } });
    const roleNow = (await prisma.user.findUnique({ where: { email }, select: { role: true } }))?.role;
    const codeEmailsBefore = await countCodeEmails();
    const ipE = randomIp();
    const e = await startChallenge(ipE);
    const staffOtp = await api("/two-factor/send-otp", {}, e.jar, ipE);
    await new Promise((r) => setTimeout(r, 3000)); // give a (wrongly) sent email time to arrive
    const codeEmailsAfter = await countCodeEmails();
    report(
        "No email code is sent to a STAFF account",
        codeEmailsAfter === codeEmailsBefore,
        `role ${roleNow}, status ${staffOtp.status}, new emails ${codeEmailsAfter - codeEmailsBefore}`,
    );
    await prisma.user.update({ where: { email }, data: { role: "CUSTOMER" } });

    // 12) Disabling needs the password
    const badDisable = await api("/two-factor/disable", { password: "WrongPass999" }, session, setupIp);
    report("Turning 2FA off needs the right password", badDisable.status >= 400 && badDisable.status < 500, `status ${badDisable.status}`);
    const disable = await api("/two-factor/disable", { password: PW }, session, setupIp);
    row = await prisma.user.findUnique({ where: { email }, select: { twoFactorEnabled: true } });
    report("Correct password turns 2FA off", disable.status === 200 && row?.twoFactorEnabled !== true, `status ${disable.status}`);

    const disabledOk = await waitForAudit(me?.id, "two_factor.disabled");
    report(
        "Turning 2FA off is written to the audit log",
        disabledOk,
        `rows: ${await auditActionsFor(me?.id)}`,
    );

    // 13) Repeated wrong codes get blocked (account lockout and/or rate limit). Run last: it locks the test account.
    await api("/two-factor/enable", { password: PW }, session, setupIp);
    const secret2 = new URL(String((await api("/two-factor/enable", { password: PW }, session, setupIp)).json.totpURI ?? "http://x/?secret=")).searchParams.get("secret") ?? "";
    if (secret2) {
        await api("/two-factor/verify-totp", { code: totp(secret2) }, session, setupIp);
        const ipF = randomIp();
        const f = await startChallenge(ipF);
        let blockedAt = 0;
        for (let i = 1; i <= 14; i++) {
            const res = await api("/two-factor/verify-totp", { code: wrongCode(totp(secret2)) }, f.jar, ipF);
            if (res.status === 429 && !blockedAt) blockedAt = i;
        }
        report("Repeated wrong codes get blocked", blockedAt > 0, blockedAt ? `blocked at attempt ${blockedAt}` : "never blocked");
        const afterLock = await api("/two-factor/verify-totp", { code: totp(secret2) }, f.jar, ipF);
        report("Even the correct code is refused while blocked", afterLock.status === 429, `status ${afterLock.status}`);
    }
}

main()
    .catch((err) => {
        console.error("❌ Check crashed. Are the dev server and Mailpit running?");
        console.error(err instanceof Error ? err.message : err);
        failed = true;
    })
    .finally(async () => {
        await prisma.auditLog.deleteMany({ where: { summary: { in: ["Two-step verification turned on", "Two-step verification turned off"] } } });
        await prisma.user.deleteMany({ where: { email } });
        await prisma.$disconnect();
        process.exit(failed ? 1 : 0);
    });