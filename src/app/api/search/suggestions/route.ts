import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/locale";
import { allowRequest, clientIp } from "@/lib/memory-rate-limit";
import { normalizeQuery } from "@/lib/search-terms";
import { querySuggestions, type Suggestions } from "@/server/catalog/suggest-query";

const EMPTY: Suggestions = { products: [], categories: [] };

export async function GET(request: Request) {
  if (!allowRequest(`suggest:${clientIp(request.headers)}`, 60, 60_000)) {
    return Response.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const q = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (!q || Array.from(q).length < 2) {
    return Response.json(EMPTY, { headers: { "Cache-Control": "private, max-age=30" } });
  }

  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const suggestions = await querySuggestions(q, locale);

  return Response.json(suggestions, { headers: { "Cache-Control": "private, max-age=30" } });
}