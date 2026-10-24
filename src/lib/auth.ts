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
  sendVerificationLink,
  type Recipient,
} from "../integrations/email/auth-emails";
import { appUrl } from "../integrations/email/templates";
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
    sendOnSignIn: false, // the sign-in form sends the link itself, with the right redirect
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      sendVerificationLink(recipient(user), url);
    },
  },

  // A provider is only enabled when BOTH its id and secret are set
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
            // Facebook gives no proof the email is verified, so we verify it ourselves
            requireEmailVerification: true,
          },
        }
      : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      // A social login with the same email as an existing account is NOT merged silently.
      // The owner signs in first and links the provider explicitly (account security page).
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
        // Save the visitor's language on accounts created through Google / Facebook
        before: async (_user, ctx) => {
          if (ctx?.path !== "/callback/:id") return;
          const state = await getOAuthState<{ locale?: string }>();
          return { data: { locale: state?.locale === "my" ? "my" : "en" } };
        },
      },
    },
  },

  // Server-side validation with the same Zod schemas the forms use
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
    },
  },

  plugins: [
    twoFactor({ issuer: brand.name }),
    admin({ defaultRole: "CUSTOMER" }),
    nextCookies(), // must stay LAST
  ],
});