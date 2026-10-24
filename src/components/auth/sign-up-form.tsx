"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signUpSchema, type SignUpValues } from "@/validation/auth";

export function SignUpForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const locale = useLocale();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const fieldError = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      locale, // so our emails are sent in the visitor's language
      callbackURL: new URL("/verify-email/complete", window.location.origin).toString(),
    });

    if (error) {
      setFormError(
        error.status === 429 ? t("errors.tooManyRequests") : t("errors.generic"),
      );
      return;
    }

    // No session yet: the email must be verified first
    router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-semibold">{t("signUpTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("signUpSubtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <FormAlert message={formError} />
        <TextField
          label={t("name")}
          autoComplete="name"
          error={fieldError(errors.name?.message)}
          {...register("name")}
        />
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
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={fieldError(errors.password?.message)}
          {...register("password")}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          {isSubmitting ? t("creatingAccount") : t("signUpButton")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary hover:underline"
        >
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );

}


