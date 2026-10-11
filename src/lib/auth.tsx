"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, refreshSession } from "./api";
import type { SessionUser } from "./types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: SessionUser | null;
  can: (permission: string) => boolean;
  login: (identifier: string, password: string) => Promise<SessionUser>;
  register: (input: { email: string; password: string; firstName: string; lastName?: string; phone?: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  reload: () => Promise<SessionUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_EVERY_MS = 12 * 60_000; // access tokens live 15 minutes

/** The signed-in user, or null. An expired access token is refreshed once first. */
async function fetchSession(): Promise<SessionUser | null> {
  try {
    return (await api.get<{ user: SessionUser }>("/auth/me")).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && (await refreshSession())) {
      try {
        return (await api.get<{ user: SessionUser }>("/auth/me")).user;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const applySession = useCallback((u: SessionUser | null) => {
    setUser(u);
    setStatus(u ? "authenticated" : "anonymous");
  }, []);

  const reload = useCallback(async () => {
    const u = await fetchSession();
    applySession(u);
    return u;
  }, [applySession]);

  useEffect(() => {
    let alive = true;
    void fetchSession().then((u) => alive && applySession(u));
    const onExpired = () => {
      setUser(null);
      setStatus("anonymous");
    };
    window.addEventListener("trendz:session-expired", onExpired);
    return () => {
      alive = false;
      window.removeEventListener("trendz:session-expired", onExpired);
    };
  }, [applySession]);

  // Keep the short-lived access cookie fresh while the tab is open.
  useEffect(() => {
    if (status !== "authenticated") return;
    timer.current = setInterval(() => void refreshSession(), REFRESH_EVERY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [status]);

  const afterSignIn = useCallback(
    (u: SessionUser) => {
      setUser(u);
      setStatus("authenticated");
      // The guest cart was merged server-side; refetch everything user-specific.
      void queryClient.invalidateQueries();
      return u;
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      can: (p) => !!user?.permissions.includes(p),
      login: async (identifier, password) => afterSignIn((await api.post<{ user: SessionUser }>("/auth/login", { identifier, password })).user),
      register: async (input) => afterSignIn((await api.post<{ user: SessionUser }>("/auth/register", input)).user),
      logout: async () => {
        await api.post("/auth/logout").catch(() => undefined);
        setUser(null);
        setStatus("anonymous");
        queryClient.clear();
      },
      reload,
    }),
    [status, user, afterSignIn, reload, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
