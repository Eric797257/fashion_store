import type { CSSProperties } from "react";

export interface BrandConfig {
    name: string;
    legalName: string;
    tagline: string;
    description: string;
    /** null = render the text wordmark instead of an image */
    logo: { src: string | null; alt: string };
    contact: {
        email: string;
        phone: string;
        viber?: string;
        address: string;
        hours: string;
    };
    social: {
        facebook?: string;
        instagram?: string;
        tiktok?: string;
    };
    locale: {
        default: "en" | "my";
        supported: ReadonlyArray<"en" | "my">;
        timeZone: string;
        country: string;
    };
    currency: {
        code: string;
        symbol: string;
        position: "prefix" | "suffix";
        decimals: number;
    };
    theme: {
        /** Optional overrides of the CSS variables defined in globals.css */
        overrides: Partial<
            Record<
                | "background"
                | "surface"
                | "foreground"
                | "mutedForeground"
                | "primary"
                | "primaryHover"
                | "border",
                string
            >
        >;
    };

}

export const brand: BrandConfig = {
    name: "Fashion Store",
    legalName: "Fashion Store Co., Ltd.",
    tagline: "Modern fashion, made for everyday.",
    description: "Clothing and fashion for women and men. Cash on delivery and fast delivery across Myanmar.",
    logo: { src: null, alt: "Fashion Store" },
    contact: {
        email: "hello@example.com",
        phone: "+95 9 000 000 000",
        address: "Yangon, Myanmar",
        hours: "Daily 9:00 AM ~ 6:00 PM",
    },
    social: {
        facebook: "https://facebook.com/",
        instagram: "https://instagram.com/",
        tiktok: "https://tiktok.com/",
    },
    locale: {
        default: "en",
        supported: ["en", "my"],
        timeZone: "Asia/Yangon",
        country: "MM",
    },
    currency: { code: "MMK", symbol: "Ks", position: "suffix", decimals: 0 },
    theme: { overrides: {} },
};

const tokenToCssVar = {
    background: "--background",
    surface: "--card",
    foreground: "--foreground",
    mutedForeground: "--muted-foreground",
    primary: "--primary",
    primaryHover: "--primary-hover",
    border: "--border",
} as const; 

/** Inline CSS variables for <html>, built from brand.theme.overrides. */
export function themeStyle(): CSSProperties {
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(brand.theme.overrides)) {
        if (value) style[tokenToCssVar[key as keyof typeof tokenToCssVar]] = value;
    }
    return style as CSSProperties;
}