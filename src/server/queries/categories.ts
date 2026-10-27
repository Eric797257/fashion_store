import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { localized } from "@/i18n/localized";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/server/catalog/cache-tags";

export interface NavCategory {
  id: string;
  slug: string;
  name: string;
  children: { id: string; slug: string; name: string }[];
}

/** Active top-level categories with their active subcategories, in the right language. */
export async function getNavCategories(locale: string): Promise<NavCategory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.categories);

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
}

export interface CategoryTreeNode {
  id: string;
  slug: string;
  name: string;
  count: number;
  children: { id: string; slug: string; name: string; count: number }[];
}

/** The same tree with the number of active products in each category (for the filter sidebar). */
export async function getCategoryTree(locale: string): Promise<CategoryTreeNode[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.categories, CACHE_TAGS.products);

  const activeProducts = { select: { products: { where: { status: "ACTIVE" as const } } } };

  const rows = await db.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameMy: true,
      _count: activeProducts,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, nameMy: true, _count: activeProducts },
      },
    },
  });

  return rows.map((parent) => {
    const children = parent.children.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: localized(c.name, c.nameMy, locale),
      count: c._count.products,
    }));
    return {
      id: parent.id,
      slug: parent.slug,
      name: localized(parent.name, parent.nameMy, locale),
      count: parent._count.products + children.reduce((sum, c) => sum + c.count, 0),
      children,
    };
  });
}

export interface CategoryInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent: { slug: string; name: string } | null;
  children: { slug: string; name: string }[];
}

export async function getCategoryInfo(slug: string, locale: string): Promise<CategoryInfo | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.categories);

  const c = await db.category.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      nameMy: true,
      description: true,
      parent: { select: { slug: true, name: true, nameMy: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true, nameMy: true },
      },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    slug: c.slug,
    name: localized(c.name, c.nameMy, locale),
    description: c.description,
    parent: c.parent
      ? { slug: c.parent.slug, name: localized(c.parent.name, c.parent.nameMy, locale) }
      : null,
    children: c.children.map((child) => ({
      slug: child.slug,
      name: localized(child.name, child.nameMy, locale),
    })),
  };
}