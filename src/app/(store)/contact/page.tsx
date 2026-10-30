import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { SimpleContent } from "@/components/content/simple-content";
import { brand } from "@/config/brand";
import { resolveLocale } from "@/i18n/locale";
import { getContactOverrides, getContentPage } from "@/server/catalog/home";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Content");
  return { title: t("contactTitle"), alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const locale = resolveLocale(await getLocale());
  const [t, tc, page, overrides] = await Promise.all([
    getTranslations("Content"),
    getTranslations("Catalog"),
    getContentPage("contact", locale),
    getContactOverrides(),
  ]);

  const phone = overrides.phone ?? brand.contact.phone;
  const email = overrides.email ?? brand.contact.email;
  const viberNumber = (brand.contact.viber ?? "").replace(/[^0-9+]/g, "");
  const facebook = brand.social.facebook;

  const rows = [
    {
      key: "phone",
      icon: Phone,
      label: t("phone"),
      content: <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-primary">{phone}</a>,
    },
    viberNumber
      ? {
          key: "viber",
          icon: MessageCircle,
          label: t("viber"),
          content: (
            <a href={`viber://chat?number=${encodeURIComponent(viberNumber)}`} className="hover:text-primary">
              {brand.contact.viber}
            </a>
          ),
        }
      : null,
    {
      key: "email",
      icon: Mail,
      label: t("email"),
      content: <a href={`mailto:${email}`} className="hover:text-primary">{email}</a>,
    },
    { key: "address", icon: MapPin, label: t("address"), content: <span>{brand.contact.address}</span> },
    { key: "hours", icon: Clock, label: t("hours"), content: <span>{brand.contact.hours}</span> },
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ label: tc("breadcrumbHome"), href: "/" }, { label: page?.title ?? t("contactTitle") }]} />

      <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{page?.title ?? t("contactTitle")}</h1>
      <div className="mt-4 text-muted-foreground">
        {page ? <SimpleContent text={page.body} /> : <p>{t("contactIntro")}</p>}
      </div>

      <ul className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map(({ key, icon: Icon, label, content }) => (
          <li key={key} className="flex items-start gap-4 px-5 py-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-medium">{content}</p>
            </div>
          </li>
        ))}
      </ul>

      {facebook && (
        <a
          href={facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-primary hover:underline"
        >
          {t("facebook")}
        </a>
      )}
    </div>
  );
}