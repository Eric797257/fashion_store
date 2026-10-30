import { useTranslations } from "next-intl";
import Link from "next/link";
import { NewsletterForm } from "@/components/store/newsletter/newsletter-form";

export function NewsletterSection() {
  const t = useTranslations("Newsletter");

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby="newsletter-title">
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center sm:px-12">
        <h2 id="newsletter-title" className="text-3xl font-semibold sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("body")}</p>
        <div className="mx-auto mt-8 max-w-md">
          <NewsletterForm />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/privacy-policy" className="text-muted-foreground hover:text-primary">
            {t("privacyLink")}
          </Link>
        </p>
      </div>
    </section>
  );
}