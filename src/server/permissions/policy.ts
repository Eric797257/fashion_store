import { isPrivilegedRole, type PermissionKey } from "./catalog";

export interface PermissionHolder {
  permissions: ReadonlySet<string>;
}

export function hasPermission(
  holder: PermissionHolder | null | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(holder?.permissions.has(key));
}

/** Staff-level accounts must have two-step verification on to use privileged areas. */
export function twoFactorSatisfied(account: {
  role: string | null;
  twoFactorEnabled: boolean;
}): boolean {
  return !isPrivilegedRole(account.role) || account.twoFactorEnabled;
}

/** You may only manage accounts ranked strictly below you. */
export const canManageRank = (actorRank: number, targetRank: number) => actorRank > targetRank;

/** You may only hand out roles ranked strictly below your own. */
export const canAssignRank = (actorRank: number, newRoleRank: number) => actorRank > newRoleRank;

/** Customers reach their own records. Staff reach others' records only with the permission. */
export function canAccessOwned(
  access: PermissionHolder & { userId: string },
  ownerId: string | null | undefined,
  key: PermissionKey,
): boolean {
  return (ownerId != null && access.userId === ownerId) || hasPermission(access, key);
}