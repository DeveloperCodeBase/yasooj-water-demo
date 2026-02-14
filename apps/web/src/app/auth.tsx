import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyLangToDocument, initI18n, type Lang } from "./i18n";
import { applyThemeToDocument, type Theme } from "./theme";

export type Role = "viewer" | "analyst" | "admin" | "org_admin" | "super_admin";

export type AuthUser = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "locked";
  language: Lang;
  theme: Theme;
  lastLoginAt: string | null;
};

type ApiOk<T> = { data: T; meta: { requestId: string } };
type ApiErr = {
  error: { code: string; message: string; details?: Array<{ field?: string; issue: string }> };
  meta: { requestId: string };
};

function getBaseUrl() {
  return (import.meta as any).env?.VITE_API_BASE_URL || "/api";
}

async function parseJsonSafe(resp: Response) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  theme: Theme;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  hasMinRole: (min: Role) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3,
  org_admin: 4,
  super_admin: 5
};

function safeTheme(v: unknown): Theme {
  return v === "dark" ? "dark" : "light";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const theme = safeTheme(localStorage.getItem("theme"));
    initI18n("fa");
    applyLangToDocument("fa");
    applyThemeToDocument(theme);
    return { ready: false, user: null, accessToken, refreshToken, theme };
  });

  const baseUrl = getBaseUrl();

  const persistTokens = (accessToken: string | null, refreshToken: string | null) => {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    else localStorage.removeItem("accessToken");
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    else localStorage.removeItem("refreshToken");
  };

  const refresh = useCallback(async () => {
    if (!state.refreshToken) return null;
    const resp = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: state.refreshToken })
    });
    const json = (await parseJsonSafe(resp)) as ApiOk<{ accessToken: string; user: AuthUser }> | ApiErr | null;
    if (!resp.ok || !json || "error" in json) {
      setState((s) => ({ ...s, accessToken: null, refreshToken: null, user: null, ready: true }));
      persistTokens(null, null);
      return null;
    }
    setState((s) => ({ ...s, accessToken: json.data.accessToken, user: json.data.user, ready: true, theme: json.data.user.theme }));
    persistTokens(json.data.accessToken, state.refreshToken);
    applyLangToDocument("fa");
    applyThemeToDocument(json.data.user.theme);
    return json.data.accessToken;
  }, [baseUrl, state.refreshToken]);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const doReq = async (accessToken: string | null) => {
        const headers: Record<string, string> = {};
        if (init?.headers) Object.assign(headers, init.headers as any);
        if (!headers["content-type"] && init?.body && !(init.body instanceof FormData)) headers["content-type"] = "application/json";
        if (accessToken) headers.authorization = `Bearer ${accessToken}`;

        const resp = await fetch(`${baseUrl}${path}`, { ...init, headers });
        const json = (await parseJsonSafe(resp)) as ApiOk<T> | ApiErr | null;
        if (resp.ok && json && "data" in json) return json.data;
        const err = json && "error" in json ? json.error : { code: "UNKNOWN", message: "درخواست ناموفق بود" };
        const e: any = new Error(err.message);
        e.code = err.code;
        e.status = resp.status;
        e.details = (err as any).details ?? [];
        throw e;
      };

      try {
        return await doReq(state.accessToken);
      } catch (e: any) {
        if (e?.status === 401 && state.refreshToken) {
          const newAccess = await refresh();
          if (newAccess) return await doReq(newAccess);
        }
        throw e;
      }
    },
    [baseUrl, refresh, state.accessToken, state.refreshToken]
  );

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const resp = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe })
      });
      const json = (await parseJsonSafe(resp)) as ApiOk<{ accessToken: string; refreshToken: string; user: AuthUser }> | ApiErr | null;
      if (!resp.ok || !json || "error" in json) {
        const err = json && "error" in json ? json.error : { code: "UNKNOWN", message: "ورود ناموفق بود" };
        const e: any = new Error(err.message);
        e.code = err.code;
        e.status = resp.status;
        throw e;
      }
      persistTokens(json.data.accessToken, json.data.refreshToken);
      setState((s) => ({
        ...s,
        ready: true,
        user: json.data.user,
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        theme: json.data.user.theme
      }));
      applyLangToDocument("fa");
      applyThemeToDocument(json.data.user.theme);
    },
    [baseUrl]
  );

  const logout = useCallback(async () => {
    const refreshToken = state.refreshToken;
    persistTokens(null, null);
    setState((s) => ({ ...s, user: null, accessToken: null, refreshToken: null }));
    if (refreshToken) {
      try {
        await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken }) });
      } catch {
        // ignore
      }
    }
  }, [baseUrl, state.refreshToken]);

  const setTheme = useCallback(async (theme: Theme) => {
    localStorage.setItem("theme", theme);
    applyThemeToDocument(theme);
    setState((s) => ({ ...s, theme, user: s.user ? { ...s.user, theme } : s.user }));
    if (state.user) {
      try {
        await api("/settings/profile", { method: "PATCH", body: JSON.stringify({ theme }) });
      } catch {
        // ignore
      }
    }
  }, [api, state.user]);

  const hasMinRole = useCallback(
    (min: Role) => {
      if (!state.user) return false;
      return ROLE_RANK[state.user.role] >= ROLE_RANK[min];
    },
    [state.user]
  );

  // Hydrate user session.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (state.accessToken) {
        try {
          const me = await api<AuthUser>("/me", { method: "GET" });
          if (!cancelled) setState((s) => ({ ...s, ready: true, user: me, theme: me.theme }));
          applyLangToDocument("fa");
          applyThemeToDocument(me.theme);
          return;
        } catch {
          // fall through to refresh
        }
      }
      if (state.refreshToken) {
        await refresh();
        return;
      }
      if (!cancelled) setState((s) => ({ ...s, ready: true }));
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      setTheme,
      api,
      hasMinRole
    }),
    [api, login, logout, setTheme, state, hasMinRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
