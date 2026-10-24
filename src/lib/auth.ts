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
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const schema = authBodySchemas[ctx.path];
      if (!schema) return;

      const result = schema.safeParse(ctx.body);
      if (!result.success) {
        throw new APIError("BAD_REQUEST", {
          message: result.error.issues[0]?.message ?? "invalidInput",
        });
      }
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
      // Two-step verification (the account itself is also locked after repeated failures)
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
          // Read the role from the database. The user object Better Auth passes in here
          // does not reliably include it, and this rule must never be skipped.
          const row = await db.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          });

          // Fail closed: unknown user or any staff-level role means no email codes
          if (!row || isPrivilegedRole(row.role)) {
            console.warn("[2fa] email code refused for a privileged or unknown account");
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