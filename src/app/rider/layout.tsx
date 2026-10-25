import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/config/brand";
import { requirePermission } from "@/server/auth/access";

export const instant = false;
export const metadata: Metadata = {
  title: "Deliveries",
  robots: { index: false, follow: false },
};

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePermission("rider.access", "/rider");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="font-display text-xl font-semibold">{brand.name} · Riders</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{access.name}</span>
            <Link href="/account" className="text-primary hover:underline">
              Account
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}