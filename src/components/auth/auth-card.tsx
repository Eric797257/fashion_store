import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      {children && <div className="mt-6 space-y-4">{children}</div>}
    </div>
  );
}