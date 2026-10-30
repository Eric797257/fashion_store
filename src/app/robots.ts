import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  // Only a real https site is open to search engines. Local and test sites are not.
  if (!base.startsWith("https://")) {
    return { rules: { userAgent: "*", disallow: "/" }, sitemap: `${base}/sitemap.xml` };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/rider",
        "/api/",
        "/account",
        "/cart",
        "/checkout",
        "/search",
        "/sign-in",
        "/sign-up",
        "/verify-email",
        "/verify-otp",
        "/forgot-password",
        "/reset-password",
        "/two-factor",
        "/newsletter/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}