import { email, z } from "zod";

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

export const signUpSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
});

export const signInSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, "passwordRequired").max(128, "passwordTooLong"), 
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;