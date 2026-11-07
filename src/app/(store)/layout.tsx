import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { CartMerge } from "@/components/store/cart/cart-merge";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { WishlistProvider } from "@/components/store/wishlist/wishlist-provider";
import { CART_COOKIE } from "@/server/cart/constants";
import { getWishlistState } from "@/server/wishlist/queries";

// The language comes from a cookie, and the wishlist and cart from the visitor,
// so this layout is rendered per request.
export const instant = false;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [t, wishlist, store] = await Promise.all([
    getTranslations("Common"),
    getWishlistState(),
    cookies(),
  ]);

  // A signed-in customer who still carries a guest cart: move its items into their own cart
  const needsCartMerge = wishlist.signedIn && store.has(CART_COOKIE);

  return (
    <WishlistProvider signedIn={wishlist.signedIn} productIds={wishlist.productIds}>
      {needsCartMerge && <CartMerge />}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main-content" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter />
    </WishlistProvider>
  );
}