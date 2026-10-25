const MESSAGE_KEY: Record<string, string> = {
  account_not_linked: "accountNotLinked",
  email_not_found: "socialNoEmail",
  access_denied: "socialCancelled",
  social_sign_in_not_allowed: "socialStaffNotAllowed",
};

/** Returns a translation key under "Auth.errors", or null when there is no error. */
export function socialErrorKey(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGE_KEY[code] ?? "socialFailed";
}