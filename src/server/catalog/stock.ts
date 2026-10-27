import type { StockStatus } from "./types";

export interface VariantStock {
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
  isActive: boolean;
}

/** Units that can still be sold: on hand minus reserved, and only for active variants. */
export function variantAvailable(v: VariantStock): number {
  return v.isActive ? Math.max(0, v.stockOnHand - v.stockReserved) : 0;
}

export function summarizeStock(variants: VariantStock[]): { status: StockStatus; available: number } {
  const available = variants.reduce((sum, v) => sum + variantAvailable(v), 0);
  if (available === 0) return { status: "OUT_OF_STOCK", available };

  const threshold = Math.max(0, ...variants.filter((v) => v.isActive).map((v) => v.lowStockThreshold));
  return { status: available <= threshold ? "LOW_STOCK" : "IN_STOCK", available };
}