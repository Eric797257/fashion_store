import { useTranslations } from "next-intl";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

// Header and footer read live categories from the database on each request.
export const instant = false;

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");

  return (
    <>
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
    </>
  );
}