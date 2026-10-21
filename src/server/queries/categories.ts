import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { localized } from "@/i18n/localized";

export interface NavCategory {
  id: string;
  slug: string;
  name: string;
  children: { id: string; slug: string; name: string }[];
}

/** Active top-level categories with their active subcategories, in the right language. */
export const getNavCategories = cache(async (locale: string): Promise<NavCategory[]> => {
  const rows = await db.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameMy: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, nameMy: true },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: localized(c.name, c.nameMy, locale),
    children: c.children.map((child) => ({
      id: child.id,
      slug: child.slug,
      name: localized(child.name, child.nameMy, locale),
    })),
  }));
});