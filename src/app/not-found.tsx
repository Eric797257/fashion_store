import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-4xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <Button className="bg-primary hover:bg-primary-hover">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}