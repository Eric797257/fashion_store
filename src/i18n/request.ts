import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { brand } from "@/config/brand";
import { LOCALE_COOKIE, resolveLocale } from "./locale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    timeZone: brand.locale.timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});