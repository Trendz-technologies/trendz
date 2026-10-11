"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { EASE_OUT } from "./motion";

/** "Copy code" button that flips to a green "Copied" tick for a moment. */
export function CopyCodeButton({ code }: { code: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      toast(t("Couldn't copy automatically — the code is {code}", { code }), "info");
    }
  };

  return (
    <>
      <m.button
        type="button"
        onClick={copy}
        whileTap={{ scale: 0.95 }}
        aria-label={t("Copy code {code}", { code })}
        className={clsx(
          "relative inline-flex h-11 min-w-[8.75rem] items-center justify-center overflow-hidden rounded-full px-5 text-sm font-semibold text-white transition-colors duration-300",
          "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
          copied ? "bg-success" : "bg-ink hover:bg-ink/85",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {copied ? (
            <m.span key="copied" className="flex items-center gap-2" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
              <m.span initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 16, delay: 0.05 }} className="grid place-items-center">
                <Check size={16} strokeWidth={2.75} />
              </m.span>
              {t("Copied")}
            </m.span>
          ) : (
            <m.span key="copy" className="flex items-center gap-2" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
              <Copy size={15} />
              {t("Copy code")}
            </m.span>
          )}
        </AnimatePresence>
      </m.button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t("Code {code} copied to clipboard", { code }) : ""}
      </span>
    </>
  );
}
