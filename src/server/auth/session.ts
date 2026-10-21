import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** The current session, or null. Cached per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** For pages that need a signed-in user. Redirects to sign-in otherwise. */
export async function requireUser(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}