import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { isPrivilegedRole, type PermissionKey } from "@/server/permissions/catalog";
import { hasPermission, twoFactorSatisfied } from "@/server/permissions/policy";

export interface Access {
  userId: string;
  email: string;
  name: string;
  role: string | null;
  rank: number;
  permissions: ReadonlySet<string>;
  twoFactorEnabled: boolean;
  isPrivileged: boolean;
}

/** Current user plus role and permissions, read fresh from the database. Cached per request. */
export const getAccess = cache(async (): Promise<Access | null> => {
  const session = await getSession();
  if (!session) return null;

  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      role: true,
      banned: true,
      twoFactorEnabled: true,
      roleRecord: {
        select: {
          rank: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  // A missing or banned account has no access, whatever the cookie says
  if (!row || row.banned) return null;

  return {
    userId: session.user.id,
    email: row.email,
    name: row.name,
    role: row.role,
    rank: row.roleRecord?.rank ?? 0,
    permissions: new Set(row.roleRecord?.permissions.map((rp) => rp.permission.key) ?? []),
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    isPrivileged: isPrivilegedRole(row.role),
  };
});

// ---------------------------------------------------------------------------
// For PAGES: redirect or 404
// ---------------------------------------------------------------------------

/** Any signed-in, non-banned user. */
export async function requireAccess(returnTo: string): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return access;
}

/**
 * Signed in + holds the permission + (for staff-level roles) has 2FA on.
 * Call it in EVERY admin/rider page, not only the layout.
 */
export async function requirePermission(key: PermissionKey, returnTo: string): Promise<Access> {
  const access = await requireAccess(returnTo);
  if (!hasPermission(access, key)) notFound(); // don't reveal that the area exists
  if (!twoFactorSatisfied(access)) redirect("/account/security?required=1");
  return access;
}

// ---------------------------------------------------------------------------
// For SERVER ACTIONS and ROUTE HANDLERS: throw, never redirect
// ---------------------------------------------------------------------------

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "TWO_FACTOR_REQUIRED",
  ) {
    super(code);
  }
}

export async function assertPermission(key: PermissionKey): Promise<Access> {
  const access = await getAccess();
  if (!access) throw new AuthorizationError(401, "UNAUTHENTICATED");
  if (!hasPermission(access, key)) throw new AuthorizationError(403, "FORBIDDEN");
  if (!twoFactorSatisfied(access)) throw new AuthorizationError(403, "TWO_FACTOR_REQUIRED");
  return access;
}

/** For route handlers: turns an AuthorizationError into a JSON response, else returns null. */
export function authorizationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) return null;
  return Response.json(
    { error: error.code },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}