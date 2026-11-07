"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { mergeGuestCart } from "@/server/cart/actions";

/**
 * Rendered only when a signed-in customer still has a guest-cart cookie.
 * It moves the guest items into their own cart, then refreshes the page.
 */
export function CartMerge() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void mergeGuestCart().then(() => router.refresh());
  }, [router]);

  return null;
}