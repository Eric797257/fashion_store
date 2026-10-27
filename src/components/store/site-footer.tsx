import { Banknote, Clock, Mail, MapPin, PackageSearch, Phone, Truck } from "lucide-react";
import { cacheLife } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitch } from "@/components/store/language-switch";
import { Logo } from "@/components/store/logo";
import { brand } from "@/config/brand";
import { getNavCategories } from "@/server/queries/categories";

const SOCIAL_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
} as const;

/** The current year, cached. Reading the clock inside a cache is allowed, and it refreshes daily. */
async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const [t, locale, year] = await Promise.all([
    getTranslations("Footer"),
    getLocale(),
    getCurrentYear(),
  ]);
  const categories = await getNavCategories(locale);

  const linkClass = "text-sm text-muted-foreground transition hover:text-primary";
  const headingClass = "mb-4 text-sm font-semibold uppercase tracking-wide";

  const socials = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).flatMap(
    (key) => {
      const href = brand.social[key];
      return href ? [{ key, href, label: SOCIAL_LABELS[key] }] : [];
    },
  );

  return (
    <footer className="mt-24 border-t border-border bg-card">
      {/* Trust strip */}
      <div className="border-b border-border">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: Banknote, text: t("trust1") },
            { icon: Truck, text: t("trust2") },
            { icon: PackageSearch, text: t("trust3") },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="space-y-4 lg:col-span-2">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t("tagline")}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {brand.contact.address}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden />
              <a
                href={`tel:${brand.contact.phone.replace(/\s+/g, "")}`}
                className="hover:text-primary"
              >
                {brand.contact.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden />
              <a href={`mailto:${brand.contact.email}`} className="hover:text-primary">
                {brand.contact.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 shrink-0" aria-hidden />
              {brand.contact.hours}
            </li>
          </ul>
        </div>

        <nav aria-label={t("shop")}>
          <h2 className={`${headingClass} font-sans`}>{t("shop")}</h2>
          <ul className="space-y-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.slug}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("customerCare")}>
          <h2 className={`${headingClass} font-sans`}>{t("customerCare")}</h2>
          <ul className="space-y-3">
            <li><Link href="/track-order" className={linkClass}>{t("trackOrder")}</Link></li>
            <li><Link href="/shipping-policy" className={linkClass}>{t("shippingPolicy")}</Link></li>
            <li><Link href="/return-policy" className={linkClass}>{t("returnPolicy")}</Link></li>
            <li><Link href="/contact" className={linkClass}>{t("contact")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("company")}>
          <h2 className={`${headingClass} font-sans`}>{t("company")}</h2>
          <ul className="space-y-3">
            <li><Link href="/about" className={linkClass}>{t("about")}</Link></li>
            <li><Link href="/privacy-policy" className={linkClass}>{t("privacyPolicy")}</Link></li>
            <li><Link href="/terms" className={linkClass}>{t("terms")}</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {year} {brand.legalName}. {t("rights")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {socials.length > 0 && (
              <ul className="flex items-center gap-4" aria-label={t("followUs")}>
                {socials.map((s) => (
                  <li key={s.key}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </footer>
  );
}