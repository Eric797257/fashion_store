import { randomUUID } from "node:crypto";
import { db } from "./db";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

const keyFor = (email: string) => `acct-login:${email.trim().toLowerCase()}`;

/** True when this email has too many recent failures. Works the same for unknown emails. */
export async function isLockedOut(email: string): Promise<boolean> {
  const row = await db.rateLimit.findUnique({ where: { key: keyFor(email) } });
  if (!row) return false;
  return row.count >= MAX_FAILURES && Date.now() - Number(row.lastRequest) < WINDOW_MS;
}

export async function recordFailure(email: string): Promise<void> {
  const key = keyFor(email);
  const now = Date.now();
  const row = await db.rateLimit.findUnique({ where: { key } });
  const count = row && now - Number(row.lastRequest) < WINDOW_MS ? row.count + 1 : 1;

  await db.rateLimit.upsert({
    where: { key },
    update: { count, lastRequest: BigInt(now) },
    create: { id: randomUUID(), key, count, lastRequest: BigInt(now) },
  });
}

export async function clearFailures(email: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key: keyFor(email) } });
}