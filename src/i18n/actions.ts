"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALES } from "./locale";

const localeSchema = z.enum(LOCALES);

export async function setLocale(input: string) {
  const parsed = localeSchema.safeParse(input); // never trust the browser
  if (!parsed.success) return { ok: false as const };

  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}