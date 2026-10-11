"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "motion/react";
import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";

/** Shared wishlist state (one request for the whole page, however many hearts are shown). */
export function useWishlist() {
  const { status } = useAuth();
  return useQuery({ queryKey: ["wishlist"], queryFn: () => api.get<{ productId: string }[]>("/account/wishlist"), enabled: status === "authenticated", staleTime: 60_000 });
}

export function WishlistButton({ productId, productName, className, size = 16 }: { productId: string; productName: string; className?: string; size?: number }) {
  const { t } = useI18n();
  const { status } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const wishlist = useWishlist();
  const saved = !!wishlist.data?.some((w) => w.productId === productId);
  const toggle = useMutation({
    mutationFn: () => (saved ? api.delete(`/account/wishlist/${productId}`) : api.post("/account/wishlist", { productId })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast(saved ? t("Removed from wishlist") : t("Saved to wishlist"));
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <button
      type="button"
      onClick={() => (status === "authenticated" ? toggle.mutate() : toast(t("Sign in to save items to your wishlist"), "info"))}
      disabled={toggle.isPending}
      aria-pressed={saved}
      aria-label={saved ? t("Remove {name} from wishlist", { name: productName }) : t("Save {name} to wishlist", { name: productName })}
      className={clsx("grid place-items-center rounded-full transition", className)}
    >
      <m.span key={saved ? "on" : "off"} initial={saved ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14 }} className="grid place-items-center">
        <Heart size={size} strokeWidth={1.8} className={clsx("transition-colors", saved ? "fill-accent text-accent" : "text-ink")} />
      </m.span>
    </button>
  );
}
