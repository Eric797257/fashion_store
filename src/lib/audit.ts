import type { Prisma } from "../generated/prisma/client";
import { db } from "./db";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string; // e.g. "two_factor.disabled"
  entityType: string; // e.g. "User"
  entityId?: string | null;
  summary?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes one audit row. A failure is logged (without personal data) but never
 * stops the action that triggered it.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: input.before,
        after: input.after,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error(
      `[audit] could not write "${input.action}":`,
      err instanceof Error ? err.message : "unknown error",
    );
  }
}