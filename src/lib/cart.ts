"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Cart } from "./types";

export const CART_KEY = ["cart"] as const;

/** The server-priced cart. Waits for the session check so a logged-in user never sees the guest cart. */
export function useCart() {
  const { status } = useAuth();
  return useQuery({ queryKey: CART_KEY, queryFn: () => api.get<Cart>("/cart"), enabled: status !== "loading", staleTime: 10_000 });
}

function useCartMutation<V>(fn: (v: V) => Promise<Cart>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (cart) => qc.setQueryData(CART_KEY, cart) });
}

export const useAddToCart = () => useCartMutation((v: { variantId: string; quantity: number }) => api.post<Cart>("/cart/items", v));
export const useUpdateCartItem = () => useCartMutation((v: { itemId: string; quantity: number }) => api.patch<Cart>(`/cart/items/${v.itemId}`, { quantity: v.quantity }));
export const useRemoveCartItem = () => useCartMutation((itemId: string) => api.delete<Cart>(`/cart/items/${itemId}`));
export const useApplyCoupon = () => useCartMutation((code: string) => api.post<Cart>("/cart/coupon", { code }));
export const useRemoveCoupon = () => useCartMutation(() => api.delete<Cart>("/cart/coupon"));
