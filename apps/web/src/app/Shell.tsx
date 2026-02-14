import React, { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, type Role } from "./auth";
import { cn } from "../lib/cn";
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  ChartLine,
  Database,
  Droplets,
  FileText,
  Gauge,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  Wand2
} from "lucide-react";

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
  minRole: Role;
};

const ROLE_RANK: Record<Role, number> = { viewer: 1, analyst: 2, admin: 3, org_admin: 4, super_admin: 5 };
function hasMinRole(role: Role, min: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function AppShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const items: NavItem[] = useMemo(
    () => [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: <Gauge size={18} />, minRole: "viewer" },
      { to: "/wells", labelKey: "nav.wells", icon: <Droplets size={18} />, minRole: "viewer" },
      { to: "/forecasts", labelKey: "nav.forecasts", icon: <ChartLine size={18} />, minRole: "viewer" },
      { to: "/notifications", labelKey: "nav.notifications", icon: <Bell size={18} />, minRole: "viewer" },
      { to: "/reports", labelKey: "nav.reports", icon: <FileText size={18} />, minRole: "viewer" },
      { to: "/settings/profile", labelKey: "nav.profile", icon: <Settings size={18} />, minRole: "viewer" },

      { to: "/datasets", labelKey: "nav.datasets", icon: <Database size={18} />, minRole: "analyst" },
      { to: "/scenarios", labelKey: "nav.scenarios", icon: <Wand2 size={18} />, minRole: "analyst" },
      { to: "/models", labelKey: "nav.models", icon: <BookOpen size={18} />, minRole: "analyst" },
      { to: "/alerts", labelKey: "nav.alerts", icon: <Activity size={18} />, minRole: "analyst" },

      { to: "/users", labelKey: "nav.users", icon: <Users size={18} />, minRole: "org_admin" },
      { to: "/settings/org", labelKey: "nav.orgSettings", icon: <Building2 size={18} />, minRole: "org_admin" },
      { to: "/audit-logs", labelKey: "nav.audit", icon: <Shield size={18} />, minRole: "org_admin" },

      { to: "/orgs", labelKey: "nav.orgs", icon: <Shield size={18} />, minRole: "super_admin" }
    ],
    []
  );

  const role = auth.user?.role ?? "viewer";
  const visibleItems = items.filter((it) => hasMinRole(role, it.minRole));

  const currentLabel =
    visibleItems.find((it) => location.pathname === it.to || location.pathname.startsWith(it.to + "/"))?.labelKey ??
    null;

  const sidebar = (
    <aside
      className={cn(
        "h-full w-[280px] shrink-0 border-border bg-card/70 backdrop-blur",
        // Sidebar is always on the right in RTL.
        "border-l"
      )}
    >
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-card/60 border border-border grid place-items-center overflow-hidden shadow-soft-md">
            <img src="/logo.svg" alt="لوگو" className="h-7 w-7 object-contain" />
          </div>
          <div className="leading-tight text-right">
            <div className="text-[13px] text-muted">{t("app.name")}</div>
            <div className="text-[12px] text-muted">{auth.user?.email}</div>
          </div>
        </Link>
        <button
          className="lg:hidden rounded-lg border border-border px-2 py-2 text-muted hover:text-text"
          onClick={() => setMobileOpen(false)}
          aria-label="بستن"
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="p-2">
        {visibleItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition",
                "hover:bg-black/5 dark:hover:bg-white/5",
                isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-text border border-transparent"
              )
            }
          >
            <span className="text-muted">{it.icon}</span>
            <span>{t(it.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-3 border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] text-muted">{t(`roles.${role}`)}</div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-border px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => void auth.setTheme(auth.theme === "dark" ? "light" : "dark")}
              title="پوسته"
            >
              {auth.theme === "dark" ? "پوسته روشن" : "پوسته تیره"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[13px] hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => void auth.logout()}
            >
              <LogOut size={16} />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className={cn("h-full font-fa")}>
      <div className={cn("h-full flex")}>
        <div className="hidden lg:block">{sidebar}</div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="lg:hidden sticky top-0 z-20 bg-card/70 backdrop-blur border-b border-border">
            <div className="px-3 py-2 flex items-center justify-between">
              <button
                className="rounded-xl border border-border px-3 py-2"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="منو"
              >
                <Menu size={18} />
              </button>
              <div className="text-[13px] text-muted truncate max-w-[60vw]">
                {t("app.name")}
                {currentLabel ? <span className="opacity-60"> · {t(currentLabel)}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border border-border px-3 py-2 text-[12px]"
                  onClick={() => void auth.setTheme(auth.theme === "dark" ? "light" : "dark")}
                >
                  {auth.theme === "dark" ? "پوسته روشن" : "پوسته تیره"}
                </button>
              </div>
            </div>
          </div>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>

          <footer className="px-4 py-3 text-[12px] text-muted border-t border-border bg-card/40">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>دمو سامانه تصمیم‌یار · داده دمو · مستندات سرویس: /api/docs</div>
              <div className="opacity-80">
                مالکیت و حقوق این سامانه متعلق به شرکت شبکه هوشمند ابتکار ویستا است.
              </div>
            </div>
          </footer>
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className={cn("absolute inset-y-0 w-[280px] shadow-soft-lg right-0")}>{sidebar}</div>
        </div>
      ) : null}
    </div>
  );
}
