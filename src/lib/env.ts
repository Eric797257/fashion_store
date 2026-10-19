import "server-only";
import { z } from "zod";

// Empty strings in .env should count as "not set"
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  DATABASE_URL: z.string().min(1).startsWith("postgresql://"),

  BETTER_AUTH_SECRET: optional,
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  FACEBOOK_CLIENT_ID: optional,
  FACEBOOK_CLIENT_SECRET: optional,

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  EMAIL_FROM: z.string().default("Brand Store <no-reply@example.com>"),

  SMS_PROVIDER: z.enum(["none"]).default("none"),

  PAYMENT_MODE: z.enum(["dev", "live"]).default("dev"),
  PAYMENT_WEBHOOK_SECRET: optional,
  CARRIER_MODE: z.enum(["mock", "live"]).default("mock"),
  CARRIER_WEBHOOK_SECRET: optional,

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${problems}`);
}

const data = parsed.data;

// Extra rules that only apply in production
if (data.NODE_ENV === "production") {
  const missing: string[] = [];
  if (!data.BETTER_AUTH_SECRET || data.BETTER_AUTH_SECRET.length < 32)
    missing.push("BETTER_AUTH_SECRET (min 32 chars)");
  if (data.PAYMENT_MODE === "live" && !data.PAYMENT_WEBHOOK_SECRET)
    missing.push("PAYMENT_WEBHOOK_SECRET (PAYMENT_MODE=live)");
  if (data.CARRIER_MODE === "live" && !data.CARRIER_WEBHOOK_SECRET)
    missing.push("CARRIER_WEBHOOK_SECRET (CARRIER_MODE=live)");
  if (missing.length) {
    throw new Error(`Missing required production variables:\n  - ${missing.join("\n  - ")}`);
  }
}

export const env = data;

/** Social login buttons only appear when both values exist. */
export const socialProviders = {
  google: Boolean(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET),
  facebook: Boolean(data.FACEBOOK_CLIENT_ID && data.FACEBOOK_CLIENT_SECRET),
} as const;