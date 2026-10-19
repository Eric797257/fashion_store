import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { brand } from "../config/brand";
import { db } from "./db";

// NOTE: no import of ./env here on purpose. The Better Auth CLI runs this file
// outside Next.js. Better Auth reads BETTER_AUTH_SECRET / BETTER_AUTH_URL itself.

export const auth = betterAuth({
    appName: brand.name,
    database: prismaAdapter(db, { provider: "postgresql" }),

    emailAndPassword: { enabled: true },

    user: {
        additionalFields: {
            phone: { type: "string", required: false },
            locale: { type: "string", required: false, defaultValue: "en" },
        },
    },

    plugins: [
        twoFactor({ issuer: brand.name }), // TOTP + backup codes -> adds TwoFactor table
        admin({ defaultRole: "CUSTOMER" }), // adds role / banned fields to User
        nextCookies(), // must stay LAST
    ],
});