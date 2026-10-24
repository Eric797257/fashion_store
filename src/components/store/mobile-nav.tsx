"use client";

import { ChevronDown, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LanguageSwitch } from "@/components/store/language-switch";
import type { NavCategory } from "@/server/queries/categories";

export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const linkClass = "block rounded-md py-3 text-base font-medium hover:text-primary";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={t("openMenu")}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-6">
          <SheetHeader className="p-0">
            <SheetTitle>{t("menu")}</SheetTitle>
            <SheetDescription className="sr-only">{t("mainNavigation")}</SheetDescription>
          </SheetHeader>

          <nav aria-label={t("mainNavigation")} className="mt-4">
            <Link href="/products" onClick={close} className={`${linkClass} border-b`}>
              {t("shopAll")}
            </Link>

            {categories.map((c) =>
              c.children.length > 0 ? (
                <details key={c.id} className="group border-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
                    {c.name}
                    <ChevronDown
                      className="size-4 transition group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <ul className="pb-3 pl-3">
                    <li>
                      <Link
                        href={`/categories/${c.slug}`}
                        onClick={close}
                        className="block py-2 text-sm text-muted-foreground hover:text-primary"
                      >
                        {t("viewAll")}
                      </Link>
                    </li>
                    {c.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/categories/${child.slug}`}
                          onClick={close}
                          className="block py-2 text-sm hover:text-primary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  onClick={close}
                  className={`${linkClass} border-b`}
                >
                  {c.name}
                </Link>
              ),
            )}

            <Link href="/track-order" onClick={close} className={`${linkClass} border-b`}>
              {t("trackOrder")}
            </Link>
            <Link href="/sign-in" onClick={close} className={linkClass}>
              {t("signIn")}
            </Link>
          </nav>

          <div className="mt-6">
            <LanguageSwitch />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}