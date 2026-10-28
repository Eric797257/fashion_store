export interface VariantOption {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  /** Units a customer could buy right now, capped for display. */
  available: number;
  /** True when stock is at or below the low-stock threshold. */
  low: boolean;
}

export interface ImageOption {
  url: string;
  alt: string;
  color: string | null;
}

export const uniqueInOrder = (values: string[]): string[] => [...new Set(values)];

export function colorsOf(variants: VariantOption[]): { name: string; hex: string | null }[] {
  const seen = new Map<string, string | null>();
  for (const v of variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex);
  return [...seen].map(([name, hex]) => ({ name, hex }));
}

export function findVariant(
  variants: VariantOption[],
  color: string,
  size: string,
): VariantOption | null {
  return variants.find((v) => v.color === color && v.size === size) ?? null;
}

export const colorHasStock = (variants: VariantOption[], color: string): boolean => variants.some((v) => v.color === color && v.available > 0);

// export const colorHasStock = (variants: VariantOption[], color: string): boolean =>
//   variants.some((v) => v.color === color && v.available > 0);

/** What to show first. Honours the URL if it names a real variant, else the first one in stock. */
export function initialSelection(
  variants: VariantOption[],
  requested: { color?: string; size?: string },
): { color: string; size: string } | null {
  if (variants.length === 0) return null;

  if (requested.color && requested.size) {
    const exact = findVariant(variants, requested.color, requested.size);
    if (exact) return { color: exact.color, size: exact.size };
  }

  const inColor = requested.color ? variants.filter((v) => v.color === requested.color) : [];
  const pool = inColor.length > 0 ? inColor : variants;
  const best = pool.find((v) => v.available > 0) ?? pool[0];
  return best ? { color: best.color, size: best.size } : null;
}

/** Keeps the current size when the new colour has it in stock, otherwise picks a sensible one. */
export function sizeAfterColorChange(
  variants: VariantOption[],
  newColor: string,
  currentSize: string,
): string {
  const same = findVariant(variants, newColor, currentSize);
  if (same && same.available > 0) return currentSize;
  const inColor = variants.filter((v) => v.color === newColor);
  return (inColor.find((v) => v.available > 0) ?? inColor[0] ?? same)?.size ?? currentSize;
}

/** Photos for the chosen colour (plus photos that belong to every colour). */
export function imagesForColor(images: ImageOption[], color: string): ImageOption[] {
  const matching = images.filter((i) => i.color === null || i.color === color);
  return matching.length > 0 ? matching : images;
}