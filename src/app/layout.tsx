import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Noto_Sans_Myanmar } from "next/font/google";
import { brand, themeStyle } from "@/config/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const myanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-myanmar",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: `${brand.name} - ${brand.tagline}`, template: `%s | ${brand.name}` },
  description: brand.description,
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={brand.locale.default}
      style={themeStyle()}
      className={`${inter.variable} ${cormorant.variable} ${myanmar.variable}`}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
