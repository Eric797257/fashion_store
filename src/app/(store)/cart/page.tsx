import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CartLine } from "@/components/store/cart/cart-line";
import { CartSummary } from "@/components/store/cart/cart-summary";
import { FixCartButton } from "@/components/store/cart/fix-cart-button";
import { buttonVariants } from "@/components/ui/button";
import { resolveLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { getReadOwner } from "@/server/cart/queries";
import { findCartForRead, loadCartView } from "@/server/cart/service";
import { getShippingZones } from "@/server/queries/shipping";

// Private to the visitor: never cached, never indexed
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cart");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const locale = resolveLocale(await getLocale());
  const [t, owner, zones] = await Promise.all([
    getTranslations("Cart"),
    getReadOwner(),
    getShippingZones(),
  ]);

  const cart = owner ? await findCartForRead(owner) : null;
  const view = cart
    ? await loadCartView(cart.id, {
        locale,
        userId: owner && "userId" in owner ? owner.userId : null,
      })
    : null;

  if (!view || view.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-6 text-4xl font-semibold">{t("emptyTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("emptyBody")}</p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "mt-8 bg-primary text-primary-foreground hover:bg-primary-hover")}
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const netById = new Map(view.priced.lines.map((l) => [l.id, l.net]));
  const grossById = new Map(view.priced.lines.map((l) => [l.id, l.gross]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>

      {view.hasIssues && (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <div>
            <p className="font-medium text-destructive">{t("issuesTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("issuesBody")}</p>
          </div>
          <FixCartButton />
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <section aria-label={t("title")}>
          <ul className="divide-y divide-border">
            {view.lines.map((line) => (
              <CartLine
                key={line.itemId}
                line={line}
                // The line price before the coupon, so each row matches "each × quantity"
                lineTotal={grossById.get(line.itemId) ?? netById.get(line.itemId) ?? 0}
              />
            ))}
          </ul>
          <Link href="/products" className="mt-8 inline-block text-primary hover:underline">
            ← {t("continueShopping")}
          </Link>
        </section>

        <CartSummary
          totals={{
            subtotal: view.priced.subtotal,
            discountTotal: view.priced.discountTotal,
            taxTotal: view.priced.taxTotal,
            total: view.priced.total,
          }}
          coupon={view.coupon}
          tax={view.tax}
          zones={zones}
          hasIssues={view.hasIssues}
          itemCount={view.payableCount}
        />
      </div>
    </div>
  );
}