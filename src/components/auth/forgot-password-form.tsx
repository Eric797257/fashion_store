"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { FormNotice } from "@/components/auth/form-notice";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/validation/auth";

export function ForgotPasswordForm() {
    const t = useTranslations("Auth");
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: "" },
    });

    async function onSubmit(values: ForgotPasswordValues) {
        setFormError(null);
        setSentTo(null);

        const { error } = await authClient.requestPasswordReset({
            email: values.email,
            redirectTo: new URL("/reset-password", window.location.origin).toString(),
        });

        if (error) {
            setFormError(error.status === 429 ? t("errors.tooManyRequests") : t("errors.generic"));
            return;
        }

        // Same message whether or not the account exists
        setSentTo(values.email);
    }

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <h1 className="text-3xl font-semibold">{t("forgotTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("forgotSubtitle")}</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
                <FormNotice message={sentTo ? t("forgotSent", { email: sentTo }) : null} />
                <FormAlert message={formError} />
                <TextField 
                    label={t("email")}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    error = {errors.email?.message ? t(`errors.${errors.email.message}`) : undefined}
                    {...register("email")}
                />
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
                >
                    {isSubmitting ? t("sending") : t("sendResetLink")}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm">
                <Link href="/sign-in" className="text-primary hover:underline">
                    {t("backToSignIn")}
                </Link>
            </p>
        </div>
    );
}