import { BadgeCheck, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReviewSummary } from "@/server/catalog/detail-query";

function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= filled ? "fill-current text-primary" : "text-border"}`}
        />
      ))}
    </span>
  );
}

export function ReviewsSection({ summary }: { summary: ReviewSummary }) {
  const t = useTranslations("Product");
  const format = useFormatter();

  return (
    <section aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-3xl font-semibold">
        {t("reviewsTitle")}
      </h2>

      {summary.count === 0 ? (
        <p className="mt-4 text-muted-foreground">{t("noReviews")}</p>
      ) : (
        <div className="mt-6 grid gap-10 md:grid-cols-[16rem_1fr]">
          <div>
            <p className="text-5xl font-semibold">{summary.average.toFixed(1)}</p>
            <div className="mt-2">
              <Stars value={summary.average} className="size-5" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("reviewsCount", { count: summary.count })}
            </p>

            <ul className="mt-5 space-y-2 text-sm">
              {([5, 4, 3, 2, 1] as const).map((stars) => {
                const n = summary.distribution[stars];
                const pct = Math.round((n / summary.count) * 100);
                return (
                  <li
                    key={stars}
                    className="flex items-center gap-2"
                    aria-label={t("starsRowLabel", { stars, count: n })}
                  >
                    <span className="w-6 text-muted-foreground" aria-hidden>
                      {stars}★
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 text-right text-muted-foreground" aria-hidden>
                      {n}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="divide-y divide-border">
            {summary.reviews.map((review) => (
              <li key={review.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span role="img" aria-label={t("ratingOutOf", { rating: review.rating })}>
                    <Stars value={review.rating} />
                  </span>
                  {review.title && <h3 className="font-sans text-base font-semibold">{review.title}</h3>}
                </div>
                {/* Review text is plain text. React escapes it, so it can never run as HTML. */}
                {review.body && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
                )}
                <p className="mt-3 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{review.author || t("anonymous")}</span>
                  <span>{format.dateTime(new Date(review.createdAt), { dateStyle: "medium" })}</span>
                  {review.verified && (
                    <span className="inline-flex items-center gap-1 text-success">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      {t("verifiedPurchase")}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}