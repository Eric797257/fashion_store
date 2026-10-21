"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInValues } from "@/validation/auth";

export function SignInForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

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
      <p className="mt-2 text-sm text-muted-foreground">{t("signInSubtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
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