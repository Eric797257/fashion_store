import { z } from "zod";

export const nameSchema = z.string().trim().min(2, "nameLength").max(80, "nameLength");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "emailRequired")
  .max(254, "emailInvalid")
  .email("emailInvalid");

export const passwordSchema = z
  .string()
  .min(8, "passwordTooShort")
  .max(128, "passwordTooLong")
  .regex(/[A-Za-z]/, "passwordWeak")
  .regex(/\d/, "passwordWeak");

// ---- Forms (browser) ----

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "passwordRequired").max(128, "passwordTooLong"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "passwordRequired"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

// ---- Server: what Better Auth endpoints receive ----
const localeSchema = z.enum(["en", "my"]);

/** Validated on the server for every matching request (see hooks in auth.ts). */
export const authBodySchemas: Record<string, z.ZodType> = {
  "/sign-up/email": signUpSchema.extend({ locale: localeSchema.optional() }),
  "/sign-in/email": signInSchema,
  "/send-verification-email": z.object({ email: emailSchema }),
  "/request-password-reset": z.object({ email: emailSchema }),
  "/reset-password": z.object({
    newPassword: passwordSchema,
    token: z.string().min(1, "invalidToken").max(512, "invalidToken"),
  }),
};