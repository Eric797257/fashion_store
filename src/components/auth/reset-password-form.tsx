"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "@/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const fieldError = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });

    if (error) {
      const status = error.status ?? 0;
      setFormError(
        status === 429
          ? t("errors.tooManyRequests")
          : status === 0 || status >= 500
            ? t("errors.generic")
            : t("errors.invalidToken"),
      );
      return;
    }

    router.replace("/sign-in?reset=1");
  }

  return(
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-semibold">{t("resetTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("resetSubtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <FormAlert message={formError} />
        <TextField 
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={fieldError(errors.password?.message)}
          {...register("password")}
        />
        <TextField 
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
          error={fieldError(errors.confirmPassword?.message)}
          {...register("confirmPassword")}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          {isSubmitting ? t("updating") : t("resetButton")}
        </Button>
      </form>
    </div>
  );
}