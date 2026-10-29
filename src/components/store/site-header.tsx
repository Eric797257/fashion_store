import { ChevronDown, Heart, ShoppingBag, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { SearchBox } from "./search-box";
import { cn } from "@/lib/utils";
import { getNavCategories } from "@/server/queries/categories";
import { getWishlistState } from "@/server/wishlist/queries";

function IconLink({
    href,
    label,
    count = 0,
    className,
    children,
}: {
    href: string;
    label: string;
    count?: number;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-label={count > 0 ? `${label} (${count})` : label}
            className={cn(
                "relative inline-flex size-10 items-center justify-center rounded-full transition hover:bg-secondary",
                className,
            )}
        >
            {children}
            {count > 0 && (
                <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {count > 99 ? "99+" : count}
                </span>
            )}
        </Link>
    );
}

export async function SiteHeader() {
    const [t, locale] = await Promise.all([getTranslations("Header"), getLocale()]);
    const categories = await getNavCategories(locale);

    // The cart count is wired in Step 4. Until then its badge stays hidden instead of showing a fake number.
    const cartCount = 0;
    const { productIds: wishlistIds } = await getWishlistState();
    const wishlistCount = wishlistIds.length;

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
                <MobileNav categories={categories} />
                <Logo />

                <SearchBox className="mx-auto hidden w-full max-w-xl md:block" />

                <div className="ml-auto flex items-center">
                    <IconLink href="/account" label={t("account")}>
                        <User className="size-5" aria-hidden />
                    </IconLink>
                    <IconLink
                        href="/account/wishlist"
                        label={t("wishlist")}
                        count={wishlistCount}
                        className="hidden sm:inline-flex"
                    >
                        <Heart className="size-5" aria-hidden />
                    </IconLink>
                    <IconLink href="/cart" label={t("cart")} count={cartCount}>
                        <ShoppingBag className="size-5" aria-hidden />
                    </IconLink>
                </div>
            </div>

            {/* Mobile search row */}
            <div className="px-4 pb-3 md:hidden">
                <SearchBox />
            </div>

            {/* Desktop category menu: works with mouse and keyboard (no JavaScript needed) */}
            <nav aria-label={t("mainNavigation")} className="hidden border-t border-border lg:block">
                <ul className="mx-auto flex h-11 max-w-7xl items-center gap-8 px-8 text-sm font-medium">
                    <li>
                        <Link href="/products" className="transition hover:text-primary">
                            {t("shopAll")}
                        </Link>
                    </li>

                    {categories.map((c) => (
                        <li key={c.id} className="group relative">
                            <Link
                                href={`/categories/${c.slug}`}
                                className="inline-flex items-center gap-1 transition hover:text-primary"
                            >
                                {c.name}
                                {c.children.length > 0 && <ChevronDown className="size-3.5" aria-hidden />}
                            </Link>

                            {c.children.length > 0 && (
                                <div className="invisible absolute left-0 top-full z-50 min-w-52 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                                    <ul className="rounded-lg border border-border bg-card p-2 shadow-lift">
                                        {c.children.map((child) => (
                                            <li key={child.id}>
                                                <Link
                                                    href={`/categories/${child.slug}`}
                                                    className="block rounded-md px-3 py-2 font-normal hover:bg-secondary hover:text-primary"
                                                >
                                                    {child.name}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </li>
                    ))}

                    <li className="ml-auto">
                        <Link href="/track-order" className="transition hover:text-primary">
                            {t("trackOrder")}
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
    );
}