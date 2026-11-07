import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/server/catalog/cache-tags";

export interface ShippingRegion {
  region: string;
  townships: { id: string; name: string }[];
}

/** Active townships that have at least one active delivery method. */
export async function getShippingZones(): Promise<ShippingRegion[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.shipping);

  const zones = await db.deliveryZone.findMany({
    where: { isActive: true, rates: { some: { method: { isActive: true } } } },
    orderBy: [{ region: "asc" }, { sortOrder: "asc" }, { township: "asc" }],
    select: { id: true, region: true, township: true },
  });

  const byRegion = new Map<string, ShippingRegion>();
  for (const z of zones) {
    const entry = byRegion.get(z.region) ?? { region: z.region, townships: [] };
    entry.townships.push({ id: z.id, name: z.township });
    byRegion.set(z.region, entry);
  }
  return [...byRegion.values()];
}