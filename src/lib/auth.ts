import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { brand } from "../config/brand";
import {
  sendExistingAccountNotice,
  sendPasswordChangedNotice,
  sendPasswordResetLink,
  sendTwoFactorCode,
  sendVerificationLink,
  type Recipient,
} from "../integrations/email/auth-emails";
import { appUrl } from "../integrations/email/templates";
import { isPrivilegedRole } from "../server/permissions/catalog";
import { authBodySchemas } from "../validation/auth";
import { clearFailures, isLockedOut, recordFailure } from "./account-lockout";
import { recordAudit } from "./audit";
import { db } from "./db";

// NOTE: no import of ./env here on purpose. The Better Auth CLI runs this file
// outside Next.js. Better Auth reads BETTER_AUTH_SECRET / BETTER_AUTH_URL itself.

const clean = (value?: string) => (value && value.trim() !== "" ? value.trim() : undefined);

const googleId = clean(process.env.GOOGLE_CLIENT_ID);
const googleSecret = clean(process.env.GOOGLE_CLIENT_SECRET);
const facebookId = clean(process.env.FACEBOOK_CLIENT_ID);
const facebookSecret = clean(process.env.FACEBOOK_CLIENT_SECRET);

function recipient(user: { email: string; name?: string | null }): Recipient {
  return {
    email: user.email,
    name: user.name,
    locale: (user as { locale?: string | null }).locale,
  };
}

/** The role is ALWAYS read from the database, never from a callback's user object. */
async function roleOf(userId: string): Promise<string | null> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return row?.role ?? null;
}

function isUnauthorized(error: APIError): boolean {
  const e = error as unknown as { status?: unknown; statusCode?: unknown };
  return e.statusCode === 401 || e.status === "UNAUTHORIZED" || e.status === 401;
}

/** Successful calls to these endpoints are written to the audit log. */
const AUDITED_PATHS: Record<string, { action: string; summary: string }> = {
  "/two-factor/disable": {
    action: "two_factor.disabled",
    summary: "Two-step verification turned off",
  },
  "/two-factor/generate-backup-codes": {
    action: "two_factor.backup_codes_regenerated",
    summary: "Backup codes regenerated",
  },
  // At sign-in there is no session cookie yet, so this only matches enrollment
  "/two-factor/verify-totp": {
    action: "two_factor.enabled",
    summary: "Two-step verification turned on",
  },
  "/unlink-account": {
    action: "account.unlinked",
    summary: "A sign-in method was removed",
  },
};

export const auth = betterAuth({
  appName: brand.name,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,

    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendPasswordResetLink(recipient(user), url);
    },
    onPasswordReset: async ({ user }) => {
      sendPasswordChangedNotice(recipient(user), `${appUrl()}/forgot-password`);
    },
    onExistingUserSignUp: async ({ user }) => {
      sendExistingAccountNotice(recipient(user), `${appUrl()}/sign-in`);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      sendVerificationLink(recipient(user), url);
    },
  },

  socialProviders: {
    ...(googleId && googleSecret
      ? {
        google: {
          clientId: googleId,
          clientSecret: googleSecret,
          prompt: "select_account" as const,
        },
      }
      : {}),
    ...(facebookId && facebookSecret
      ? {
        facebook: {
          clientId: facebookId,
          clientSecret: facebookSecret,
          requireEmailVerification: true,
        },
      }
      : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
    },
  },

  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      locale: { type: "string", required: false, defaultValue: "en" },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (_user, ctx) => {
          if (ctx?.path !== "/callback/:id") return;
          const state = await getOAuthState<{ locale?: string }>();
          return { data: { locale: state?.locale === "my" ? "my" : "en" } };
        },
      },
    },
    session: {
      create: {
        // Staff-level accounts may not get a session from Google/Facebook,
        // because 2FA is not applied to social sign-in.
        before: async (session, ctx) => {
          if (ctx?.path !== "/callback/:id") return;
          const role = await roleOf(session.userId);
          if (!isPrivilegedRole(role)) return;

          await recordAudit({
            actorId: session.userId,
            actorRole: role,
            action: "auth.social_sign_in_blocked",
            entityType: "User",
            entityId: session.userId,
            summary: "Staff-level account tried to sign in with a social provider",
          });
          throw new APIError("FORBIDDEN", { message: "social_sign_in_not_allowed" });
        },
        // Every staff-level sign-in is recorded
        after: async (session) => {
          const role = await roleOf(session.userId);
          if (!isPrivilegedRole(role)) return;

          await recordAudit({
            actorId: session.userId,
            actorRole: role,
            action: "auth.sign_in",
            entityType: "User",
            entityId: session.userId,
            summary: "Staff-level sign-in",
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          });
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 1) Validate the request body with the same Zod schemas the forms use
      const schema = authBodySchemas[ctx.path];
      if (schema) {
        const result = schema.safeParse(ctx.body);
        if (!result.success) {
          throw new APIError("BAD_REQUEST", {
            message: result.error.issues[0]?.message ?? "invalidInput",
          });
        }
      }

      // 2) Per-account lockout (same answer for unknown emails, so nothing leaks)
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === "string" && (await isLockedOut(email))) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "tooManyRequests" });
        }
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned;

      // Feed the lockout: wrong password counts, correct password clears
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== "string") return;
        if (returned instanceof APIError) {
          if (isUnauthorized(returned)) await recordFailure(email);
        } else {
          await clearFailures(email);
        }
        return;
      }

      // Security audit trail (successful calls only)
      const audited = AUDITED_PATHS[ctx.path];
      if (!audited || returned instanceof APIError) return;

      // Did the request carry a session cookie?
      const cookieName = ctx.context.authCookies.sessionToken.name;
      const pair = (ctx.headers?.get("cookie") ?? "")
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${cookieName}=`));

      // verify-totp is also the last step of a sign-in. Only enrollment carries a session cookie.
      if (ctx.path === "/two-factor/verify-totp" && !pair) return;

      // Turning 2FA on or off replaces the session, so the old token is already deleted.
      // The new session created by the endpoint tells us who it was.
      let userId: string | undefined = ctx.context.newSession?.user.id;

      // Other endpoints keep the session, so look it up from the cookie
      if (!userId && pair) {
        try {
          const token =
            decodeURIComponent(pair.slice(cookieName.length + 1)).split(".")[0] ?? "";
          if (token) {
            const found = await db.session.findUnique({
              where: { token },
              select: { userId: true },
            });
            userId = found?.userId;
          }
        } catch {
          userId = undefined;
        }
      }

      if (!userId) {
        console.warn(`[audit] could not tell who called ${ctx.path}`);
        return;
      }

      await recordAudit({
        actorId: userId,
        actorRole: await roleOf(userId),
        action: audited.action,
        entityType: "User",
        entityId: userId,
        summary: audited.summary,
      });
    }),
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-in/social": { window: 60, max: 20 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/send-verification-email": { window: 600, max: 5 },
      "/request-password-reset": { window: 3600, max: 10 },
      "/reset-password": { window: 600, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 },
      "/two-factor/verify-otp": { window: 60, max: 10 },
      "/two-factor/send-otp": { window: 600, max: 5 },
      "/two-factor/enable": { window: 600, max: 10 },
      "/two-factor/disable": { window: 600, max: 10 },
      "/two-factor/generate-backup-codes": { window: 600, max: 10 },
    },
  },

  plugins: [
    twoFactor({
      issuer: brand.name,
      twoFactorCookieMaxAge: 600, // the sign-in challenge is valid for 10 minutes
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      otpOptions: {
        period: 5, // minutes
        digits: 6,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendOTP: async ({ user, otp }) => {
          // Staff-level accounts never get email codes (an inbox is weaker than an app)
          const role = await roleOf(user.id);
          if (!role || isPrivilegedRole(role)) {
            throw new APIError("FORBIDDEN", { message: "otpNotAllowed" });
          }
          await sendTwoFactorCode(recipient(user), otp);
        },
      },
    }),
    admin({ defaultRole: "CUSTOMER" }),
    nextCookies(), // must stay LAST
  ],
});