import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={brand.name}
      className={cn("inline-flex shrink-0 items-center rounded-md", className)}
    >
      {brand.logo.src ? (
        <Image 
          src={brand.logo.src}
          alt={brand.logo.alt}
          width={140}
          height={36}
          priority
          className="h-8 w-auto"
        />
      ) : (
        <span className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {brand.name}
        </span>
      )}
    </Link>
  );
}