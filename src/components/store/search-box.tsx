import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// import { Search } from "lucide-react";
// import { useTranslations } from "next-intl";
// import { cn } from "@/lib/utils";

/** Plain GET form: works without JavaScript. Suggestions are added in Step 3. */
export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations("Header");
  return (
    <form action="/search" method="get" role="search" className={cn("relative", className)}>
      <input 
        type="search"
        name="q"
        maxLength={100}
        autoComplete="off"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="h-11 w-full rounded-full border border-input bg-card pl-5 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        aria-label={t("search")}
        className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Search className="size-4" aria-hidden />
      </button>
    </form>
  );
}