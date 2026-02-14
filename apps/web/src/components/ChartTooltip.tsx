import * as React from "react";

export function ChartTooltip({
  active,
  label,
  payload,
  labelFormatter,
  nameMap,
  valueFormatter,
  hideKeys,
}: {
  active?: boolean;
  label?: unknown;
  payload?: any[];
  labelFormatter?: (label: unknown) => React.ReactNode;
  nameMap?: Record<string, string>;
  valueFormatter?: (value: unknown, key: string, entry: any) => React.ReactNode;
  hideKeys?: string[];
}) {
  if (!active || !payload?.length) return null;

  const nf = React.useMemo(() => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }), []);
  const hide = new Set<string>(hideKeys ?? []);
  const seen = new Set<string>();
  const labelNode = labelFormatter ? labelFormatter(label) : String(label ?? "");

  return (
    <div className="rounded-xl border border-border bg-card/90 backdrop-blur px-3 py-2 text-[12px] shadow-soft-md text-right">
      {labelNode ? <div className="font-semibold mb-1">{labelNode}</div> : null}
      <div className="space-y-1">
        {payload
          .filter((p) => p && p.value !== undefined && p.value !== null)
          .filter((p) => !hide.has(String(p.dataKey ?? p.name ?? "")))
          // Avoid duplicates when multiple chart primitives share the same dataKey (e.g. Area + Line).
          .filter((p) => {
            const key = String(p.dataKey ?? p.name ?? "");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((p, idx) => {
            const key = String(p.dataKey ?? p.name ?? "");
            const name = nameMap?.[key] ?? String(p.name ?? key);
            const v = valueFormatter ? valueFormatter(p.value, key, p) : p.value;
            const valueNode =
              typeof v === "number"
                ? nf.format(v)
                : typeof v === "string" && v.trim() && !Number.isNaN(Number(v))
                  ? nf.format(Number(v))
                  : String(v);
            return (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="text-muted">{name}</div>
                <div className="font-mono" dir="ltr">
                  {valueNode}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
