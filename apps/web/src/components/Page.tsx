import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { useFilters } from "../app/filters";
import { FilterBar } from "./filters/FilterBar";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted flex-wrap">
      {items.map((c, idx) => (
        <React.Fragment key={idx}>
          {idx ? <span className="opacity-60">/</span> : null}
          {c.to ? (
            <Link className="hover:text-text" to={c.to}>
              {c.label}
            </Link>
          ) : (
            <span className="text-text/80">{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function Page({
  title,
  crumbs,
  actions,
  rightPanel,
  children,
  hideFilters,
}: {
  title: React.ReactNode;
  crumbs: Crumb[];
  actions?: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
  hideFilters?: boolean;
}) {
  const filters = useFilters();

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <Breadcrumbs items={crumbs} />
          <div className="mt-2 text-[20px] font-semibold leading-tight truncate">{title}</div>
        </div>
        {actions ? (
          <div className={cn("flex items-center gap-2 flex-wrap")}>{actions}</div>
        ) : null}
      </div>

      {!hideFilters ? (
        <div className="mt-4">
          <FilterBar key={filters.appliedVersion} />
        </div>
      ) : null}

      <div className={cn("mt-5 grid gap-5", rightPanel ? "grid-cols-1 xl:grid-cols-[1fr_340px]" : "grid-cols-1")}>
        <div className="min-w-0">{children}</div>
        {rightPanel ? <div className="min-w-0">{rightPanel}</div> : null}
      </div>
    </div>
  );
}
