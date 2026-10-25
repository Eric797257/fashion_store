import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/config/brand";
import { requirePermission } from "@/server/auth/access";

export const instant = false;
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // First gate only. EVERY admin page and action checks its own, more specific permission.
  const access = await requirePermission("admin.access", "/admin");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="font-display text-xl font-semibold">
            {brand.name} <span className="text-sm font-normal text-muted-foreground">Admin</span>
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {access.email} · {access.role}
            </span>
            <Link href="/" className="text-primary hover:underline">
              View store
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}