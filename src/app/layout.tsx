import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { brand, themeStyle } from "@/config/brand";

import "@fontsource-variable/inter";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/noto-sans-myanmar/400.css";
import "@fontsource/noto-sans-myanmar/500.css";
import "@fontsource/noto-sans-myanmar/600.css";
import "@fontsource/noto-sans-myanmar/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: `${brand.name} – ${brand.tagline}`, template: `%s | ${brand.name}` },
  description: brand.description,
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
};

// The language comes from a cookie, so this layout can't be prerendered as a static shell.
export const instant = false;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} style={themeStyle()}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}