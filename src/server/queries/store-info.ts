import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/server/catalog/cache-tags";

export interface StoreInfo {
  codAvailable: boolean;
  returnWindowDays: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}

export async function getStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settings);

  const [settings, methods] = await Promise.all([
    db.storeSettings.findUnique({ where: { id: "default" } }),
    db.shippingMethod.findMany({
      where: { isActive: true },
      select: { etaMinDays: true, etaMaxDays: true, codAvailable: true },
    }),
  ]);

  const codEnabled = settings?.codEnabled ?? true;
  return {
    codAvailable: codEnabled && (methods.length === 0 || methods.some((m) => m.codAvailable)),
    returnWindowDays: settings?.returnWindowDays ?? 7,
    deliveryMinDays: methods.length > 0 ? Math.min(...methods.map((m) => m.etaMinDays)) : null,
    deliveryMaxDays: methods.length > 0 ? Math.max(...methods.map((m) => m.etaMaxDays)) : null,
  };
}