import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { db } from "../../lib/db";

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/**
 * Starts (or restarts) a subscription. Returns a confirmation token only when an
 * email must be sent. Already-subscribed or too-frequent requests return null, and
 * the visitor sees the same answer in every case.
 */
export async function requestSubscription(
  emailInput: string,
  locale: string,
  now = new Date(),
): Promise<{ confirmToken: string | null }> {
  const email = emailInput.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });

  if (existing?.status === "SUBSCRIBED") return { confirmToken: null };
  if (
    existing?.status === "PENDING" &&
    existing.confirmSentAt &&
    now.getTime() - existing.confirmSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return { confirmToken: null };
  }

  const token = newToken();
  const data = {
    status: "PENDING" as const,
    locale,
    confirmTokenHash: hashToken(token), // only the hash is stored
    confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
    confirmSentAt: now,
    confirmedAt: null,
    unsubscribedAt: null,
  };

  try {
    if (existing) {
      await db.newsletterSubscriber.update({ where: { email }, data });
    } else {
      await db.newsletterSubscriber.create({ data: { email, unsubscribeToken: newToken(), ...data } });
    }
  } catch (error) {
    // Two requests created the same address at once: the other one wins
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { confirmToken: null };
    }
    throw error;
  }

  return { confirmToken: token };
}

export async function confirmByToken(
  token: string,
  now = new Date(),
): Promise<"CONFIRMED" | "ALREADY" | "INVALID"> {
  const row = await db.newsletterSubscriber.findFirst({
    where: { confirmTokenHash: hashToken(token) },
  });
  if (!row) return "INVALID";
  if (row.status === "SUBSCRIBED") return "ALREADY";
  if (row.status !== "PENDING" || !row.confirmExpiresAt || row.confirmExpiresAt < now) return "INVALID";

  await db.newsletterSubscriber.update({
    where: { id: row.id },
    data: { status: "SUBSCRIBED", confirmedAt: now, unsubscribedAt: null },
  });
  return "CONFIRMED";
}

/** Safe to repeat. Old confirmation links stop working. */
export async function unsubscribeByToken(token: string, now = new Date()): Promise<boolean> {
  const row = await db.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!row) return false;

  if (row.status !== "UNSUBSCRIBED") {
    await db.newsletterSubscriber.update({
      where: { id: row.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: now,
        confirmTokenHash: null,
        confirmExpiresAt: null,
      },
    });
  }
  return true;
}