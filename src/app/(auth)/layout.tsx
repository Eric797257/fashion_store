import { useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitch } from "@/components/store/language-switch";
import { Logo } from "@/components/store/logo";

// The language comes from a cookie, so this layout can't be a static shell.
export const instant = false;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Auth");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-6">
        <Logo />
        <LanguageSwitch />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        {children}
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-primary">  
            ← {t("backToStore")}
          </Link>
        </p>
      </main>
    </div> 
  );
}