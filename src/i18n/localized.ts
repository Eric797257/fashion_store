/** Burmese name if we are in Burmese and one exists, otherwise English. */
export function localized(name: string, nameMy: string | null | undefined, locale: string) {
  return locale === "my" && nameMy ? nameMy : name;
}