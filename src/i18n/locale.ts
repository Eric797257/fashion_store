import { brand } from "@/config/brand";

export const LOCALES = ["en", "my"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
};

export function resolveLocale(value: string | undefined): Locale {
  return value === "en" || value === "my" ? value : brand.locale.default;
}