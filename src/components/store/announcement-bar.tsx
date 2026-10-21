import { useTranslations } from "next-intl";

export function AnnouncementBar() {
  const t = useTranslations("Header");
  return (
    <div className="bg-primary px-4 py-2 text-center text-xs text-primary-foreground sm:text-sm">
      {t("announcement")}
    </div>
  );
}