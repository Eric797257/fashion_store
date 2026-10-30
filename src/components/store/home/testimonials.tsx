import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TestimonialData } from "@/server/catalog/home-query";

export function Testimonials({ items }: { items: TestimonialData[] }) {
  const t = useTranslations("Home");
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby="testimonials-title">
      <h2 id="testimonials-title" className="text-3xl font-semibold sm:text-4xl">
        {t("testimonialsTitle")}
      </h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {items.slice(0, 3).map((item) => (
          <li key={item.id}>
            <figure className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
              <div
                className="flex gap-0.5"
                role="img"
                aria-label={t("ratingLabel", { rating: item.rating })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    aria-hidden
                    className={`size-4 ${n <= item.rating ? "fill-current text-primary" : "text-border"}`}
                  />
                ))}
              </div>
              {/* Plain text: React escapes it, so it can never run as HTML */}
              <blockquote className="mt-4 flex-1 leading-relaxed">{item.quote}</blockquote>
              <figcaption className="mt-5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{item.author}</span>
                {item.location && <span> · {item.location}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}