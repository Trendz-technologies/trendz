import type { Metadata } from "next";
import { RequireAuth } from "@/components/require-auth";

export const metadata: Metadata = { title: "Billing", robots: { index: false, follow: false } };

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth staff permission="pos.use">
      {children}
    </RequireAuth>
  );
}
