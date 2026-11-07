import { z } from "zod";
import { MAX_QUANTITY_PER_LINE } from "../config/features";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const addToCartSchema = z.object({
  variantId: id,
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

export const setQuantitySchema = z.object({
  itemId: id,
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

export const itemIdSchema = z.object({ itemId: id });
export const zoneIdSchema = z.object({ zoneId: id });
export const couponCodeSchema = z.object({ code: z.string().trim().min(1).max(60) });