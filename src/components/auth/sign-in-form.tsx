"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { FormNotice } from "@/components/auth/form-notice";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInValues } from "@/validation/auth";
import { SocialButtons } from "@/components/auth/social-buttons";

export function SignInForm({
  next,
  notice,
  providers,
  initialError,
}: {
  next: string;
  notice?: string | null;
  providers: { google: boolean; facebook: boolean };
  initialError?: string | null;
}) {
    const t = useTranslations("Auth");
    const router = useRouter();
    const [formError, setFormError] = useState<string | null>(initialError ?? null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: { email: "", password: "" },
    });

    const fieldError = (key?: string) => (key ? t(`errors.${key}`) : undefined);

    async function onSubmit(values: SignInValues) {
        setFormError(null);
        const { error } = await authClient.signIn.email({
            email: values.email,
            password: values.password,
        });

        if (error) {
            const status = error.status ?? 0;

            // Correct password, but the email is not verified yet: send a fresh link
            // that lands on our success page, then show the "check your inbox" page.
            if (status === 403) {
                await authClient.sendVerificationEmail({
                    email: values.email,
                    callbackURL: new URL(
                        "/verify-email/complete",
                        window.location.origin, 
                    ).toString(), 
                });
                router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
                return;
            }

            setFormError(
                status === 429
                    ? t("errors.tooManyRequests")
                    : status === 0 || status >= 500
                        ? t("errors.generic")
                        : t("errors.invalidCredentials"),
            );
            return;
        }

        router.replace(next);
        router.refresh();
    }

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <h1 className="text-3xl font-semibold">{t("signInTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                {t("signInSubtitle")}
            </p>

            <SocialButtons providers={providers} next={next} />

            <form onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="mt-6 space-y-6"
            >
                <FormNotice message={notice} />
                <FormAlert message={formError} />
                <TextField 
                    label={t("email")}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    error={fieldError(errors.email?.message)}
                    {...register("email")}
                />
                <TextField
                    label={t("password")}
                    type="password"
                    autoComplete="current-password"
                    error={fieldError(errors.password?.message)}
                    {...register("password")}
                />
                <div className="text-right">
                    <Link
                        href="/forgot-password"
                        className="text-sm text-primary hover:underline"
                    >
                        {t("forgotPassword")}
                    </Link>
                </div>
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
                >
                    {isSubmitting ? t("signingIn") : t("signInButton")}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link
                    href={`/sign-up?next=${encodeURIComponent(next)}`}
                    className="font-medium text-primary hover:underline"
                >
                    {t("signUpLink")}
                </Link>
            </p>
        </div>
    );
}
