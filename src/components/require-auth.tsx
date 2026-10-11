"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";

/**
 * Client-side gate for signed-in areas. The API enforces authorisation on
 * every request; this only decides what to render and where to redirect.
 */
export function RequireAuth({ children, staff = false, permission }: { children: ReactNode; staff?: boolean; permission?: string }) {
  const { status, user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <Spinner className="py-32" label={t("Checking your session")} />;
  if ((staff && !user.isStaff) || (permission && !can(permission))) {
    return (
      <div className="container-x py-24 text-center">
        <p className="text-lg font-semibold">{t("You do not have access to this page")}</p>
        <p className="mt-2 text-sm text-ink/55">{t("Ask an administrator to grant you the required role.")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
