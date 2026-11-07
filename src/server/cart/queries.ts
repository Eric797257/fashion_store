import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { TOKEN_PATTERN } from "@/lib/tokens";
import { getSession } from "@/server/auth/session";
import { CART_COOKIE } from "./constants";
import { countUnits, findCartForRead, type CartOwner } from "./service";

/** Who is looking: the signed-in customer, or a guest with a valid cart cookie. Never creates anything. */
export const getReadOwner = cache(async (): Promise<CartOwner | null> => {
  const session = await getSession();
  if (session) return { userId: session.user.id };

  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token && TOKEN_PATTERN.test(token) ? { guestToken: token } : null;
});

/** Number of units in the cart, for the header. Zero without a database query when there is no cart. */
export const getCartCount = cache(async (): Promise<number> => {
  const owner = await getReadOwner();
  if (!owner) return 0;
  const cart = await findCartForRead(owner);
  return cart ? countUnits(cart.id) : 0;
});