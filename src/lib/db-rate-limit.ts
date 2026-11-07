import { randomUUID } from "node:crypto";
import { db } from "./db";

/**
 * Fixed window. Returns true while the key is still within its limit.
 * Unlike the in-memory limiter, every server instance shares this count.
 */
export async function consumeAttempt(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const row = await db.rateLimit.findUnique({ where: { key } });

  if (!row || now - Number(row.lastRequest) >= windowMs) {
    await db.rateLimit.upsert({
      where: { key },
      update: { count: 1, lastRequest: BigInt(now) },
      create: { id: randomUUID(), key, count: 1, lastRequest: BigInt(now) },
    });
    return true;
  }

  if (row.count >= limit) return false;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}