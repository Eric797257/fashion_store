import "server-only";
import { cache } from "react";
import { getSession } from "@/server/auth/session";
import { queryWishlistProductIds } from "./read";

/** Who is looking, and which products they saved. Read once per request and shared. */
export const getWishlistState = cache(async () => {
  const session = await getSession();
  if (!session) return { signedIn: false as const, productIds: [] as string[] };
  return { signedIn: true as const, productIds: await queryWishlistProductIds(session.user.id) };
});