import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { brand } from "../config/brand";
import { signInSchema, signUpSchema } from "../validation/auth";
import { db } from "./db";

// NOTE: no import of ./env here on purpose. The Better Auth CLI runs this file
// outside Next.js. Better Auth reads BETTER_AUTH_SECRET / BETTER_AUTH_URL itself.

export const auth = betterAuth({
    appName: brand.name,
    database: prismaAdapter(db, { provider: "postgresql" }), 

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true, // becomes "verify email first" in Step 2.2
    },

    user: {
        additionalFields: {
            phone: { type: "string", required: false },
            locale: { type: "string", required: false, defaultValue: "en" },
        },
    },

    // Server-side validation with the same Zod schemas the forms use
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            const schema = 
                ctx.path === "/sign-up/email"
                    ? signUpSchema
                    : ctx.path === "/sign-in/email"
                        ? signInSchema
                        : null;
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
        enabled: true, // on in development too, so we can test it
        storage: "database", // shared by all server instances
        window: 60,
        max: 100,
        customRules: {
            "/sign-in/email": { window: 60, max: 10 },
            "/sign-up/email": { window: 3600, max: 10 },
        },
    },

    plugins: [
        twoFactor({ issuer: brand.name }),
        admin({ defaultRole: "CUSTOMER" }),
        nextCookies(), // must stay LAST
    ],
});