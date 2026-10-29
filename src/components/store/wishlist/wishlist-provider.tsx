"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { setWishlisted, type WishlistActionResult } from "@/server/wishlist/actions";

interface WishlistContextValue {
  has: (productId: string) => boolean;
  toggle: (productId: string, productName: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const ERROR_KEY = {
  INVALID: "failed",
  NOT_FOUND: "notAvailable",
  LIMIT: "limit",
  RATE_LIMITED: "rateLimited",
  FAILED: "failed",
} as const;

export function WishlistProvider({
  signedIn,
  productIds,
  children,
}: {
  signedIn: boolean;
  productIds: string[];
  children: ReactNode;
}) {
  const t = useTranslations("Wishlist");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; kind: "info" | "error" } | null>(null);

  // The heart changes at once. It settles to the server's answer when the page refreshes.
  const [optimistic, applyChange] = useOptimistic(
    productIds,
    (current: string[], change: { id: string; wanted: boolean }) =>
      change.wanted
        ? current.includes(change.id)
          ? current
          : [...current, change.id]
        : current.filter((id) => id !== change.id),
  );
  const ids = useMemo(() => new Set(optimistic), [optimistic]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const toggle = useCallback(
    (productId: string, productName: string) => {
      const goToSignIn = () =>
        router.push(
          `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );

      if (!signedIn) {
        goToSignIn();
        return;
      }

      const wanted = !ids.has(productId);
      startTransition(async () => {
        applyChange({ id: productId, wanted });
        const result: WishlistActionResult = await setWishlisted(productId, wanted);

        if (result.ok) {
          setMessage({ kind: "info", text: t(wanted ? "added" : "removed", { name: productName }) });
        } else if (result.error === "UNAUTHENTICATED") {
          goToSignIn();
        } else {
          setMessage({ kind: "error", text: t(ERROR_KEY[result.error]) });
        }

        router.refresh(); // header count and every heart settle to the server's answer
      });
    },
    [signedIn, ids, applyChange, router, t],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({ has: (id) => ids.has(id), toggle }),
    [ids, toggle],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {message && (
          <p
            className={cn(
              "rounded-full px-4 py-2 text-sm shadow-lift",
              message.kind === "error" ? "bg-destructive text-white" : "bg-foreground text-background",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return value;
}