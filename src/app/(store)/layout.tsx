import { getTranslations } from "next-intl/server";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { WishlistProvider } from "@/components/store/wishlist/wishlist-provider";
import { getWishlistState } from "@/server/wishlist/queries";

// The language comes from a cookie and the wishlist from the signed-in user,
// so this layout is rendered per request.
export const instant = false;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [t, wishlist] = await Promise.all([getTranslations("Common"), getWishlistState()]);

  return (
    <WishlistProvider signedIn={wishlist.signedIn} productIds={wishlist.productIds}>
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