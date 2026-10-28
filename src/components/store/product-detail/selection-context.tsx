"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  colorsOf,
  findVariant,
  imagesForColor,
  initialSelection,
  sizeAfterColorChange,
  uniqueInOrder,
  type ImageOption,
  type VariantOption,
} from "@/lib/variant-selection";

interface SelectionValue {
  variants: VariantOption[];
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  color: string;
  size: string;
  selected: VariantOption | null;
  images: ImageOption[];
  selectColor: (color: string) => void;
  selectSize: (size: string) => void;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({
  variants,
  images,
  requested,
  children,
}: {
  variants: VariantOption[];
  images: ImageOption[];
  requested: { color?: string; size?: string };
  children: ReactNode;
}) {
  const [state, setState] = useState(
    () => initialSelection(variants, requested) ?? { color: "", size: "" },
  );

  const apply = useCallback((next: { color: string; size: string }) => {
    setState(next);
    // Keep the choice in the address bar so the link can be shared (no page reload)
    const query = new URLSearchParams({ color: next.color, size: next.size });
    window.history.replaceState(null, "", `?${query.toString()}`);
  }, []);

  const value = useMemo<SelectionValue>(
    () => ({
      variants,
      colors: colorsOf(variants),
      sizes: uniqueInOrder(variants.map((v) => v.size)),
      color: state.color,
      size: state.size,
      selected: findVariant(variants, state.color, state.size),
      images: imagesForColor(images, state.color),
      selectColor: (color) =>
        apply({ color, size: sizeAfterColorChange(variants, color, state.size) }),
      selectSize: (size) => apply({ color: state.color, size }),
    }),
    [variants, images, state, apply],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionValue {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("useSelection must be used inside <SelectionProvider>");
  return value;
}