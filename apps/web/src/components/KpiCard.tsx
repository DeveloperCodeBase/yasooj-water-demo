import * as React from "react";
import { cn } from "../lib/cn";
import { Card } from "./ui";

export function KpiCard({
  title,
  value,
  unit,
  delta,
  icon,
  hint,
}: {
  title: string;
  value: React.ReactNode;
  unit?: string;
  delta?: number | null;
  icon?: React.ReactNode;
  hint?: string;
}) {
  const nf = React.useMemo(() => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }), []);
  const deltaTone = delta === null || delta === undefined ? "text-muted" : delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-muted";
  const deltaLabel = delta === null || delta === undefined ? "" : `${delta > 0 ? "+" : ""}${nf.format(delta)}`;
  const shownValue = typeof value === "number" ? nf.format(value) : value;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-muted flex items-center gap-2">
            <span className="truncate">{title}</span>
            {hint ? (
              <span className="text-[11px] text-muted/70" title={hint}>
                راهنما
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-[22px] font-semibold tracking-tight">{shownValue}</div>
            {unit ? <div className="text-[12px] text-muted">{unit}</div> : null}
          </div>
          {delta !== null && delta !== undefined ? (
            <div className={cn("mt-1 text-[12px]", deltaTone)}>{deltaLabel}</div>
          ) : (
            <div className="mt-1 text-[12px] text-muted/60"> </div>
          )}
        </div>
        {icon ? (
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/15 grid place-items-center text-primary">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
