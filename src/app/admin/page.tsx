"use client";

import { DashboardOverview, WelcomePanel } from "@/components/admin/system-dashboard";
import { useAuth } from "@/lib/auth";

export default function AdminHomePage() {
  const { can } = useAuth();
  return can("dashboard.read") ? <DashboardOverview /> : <WelcomePanel />;
}
