import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "./ui";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { ChartTooltip } from "./ChartTooltip";
import { formatFaNumber } from "../lib/format";

export type DatasetValidation = {
  id: string;
  datasetId: string;
  validatedAt: string;
  summary: { rows: number; columns: number; missingPct: number; invalidDatePct: number; duplicates: number };
  errors: Array<{ column: string; errorType: string; rowIndex: number; message: string }>;
  completenessByColumn: Array<{ column: string; completeness: number }>;
};

export function ValidationReportPanel({ validation }: { validation: DatasetValidation }) {
  const cards = [
    { k: "ردیف‌ها", v: formatFaNumber(validation.summary.rows, 0) },
    { k: "ستون‌ها", v: formatFaNumber(validation.summary.columns, 0) },
    { k: "کمبود داده", v: `${formatFaNumber(validation.summary.missingPct, 1)}٪` },
    { k: "تاریخ نامعتبر", v: `${formatFaNumber(validation.summary.invalidDatePct, 1)}٪` },
    { k: "تکراری‌ها", v: formatFaNumber(validation.summary.duplicates, 0) },
  ];

  const errorTypeLabel = (v: string) => {
    const s = String(v ?? "");
    const map: Record<string, string> = {
      outlier: "پرت",
      invalid_format: "فرمت نامعتبر",
      missing: "مقدار خالی",
      duplicate: "تکراری",
    };
    return map[s] ?? s;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>نتیجه اعتبارسنجی</CardTitle>
        <Badge tone="info">{formatJalaliDateTime(validation.validatedAt)}</Badge>
      </CardHeader>
      <CardBody>
        <div className="grid gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.k} className="rounded-2xl border border-border bg-card/50 px-3 py-3">
              <div className="text-[12px] text-muted">{c.k}</div>
              <div className="mt-1 text-[16px] font-semibold">{c.v as any}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold">کامل بودن ستون‌ها</div>
            <div className="mt-3 h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={validation.completenessByColumn.map((c) => ({ ...c, pct: Math.round(c.completeness * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="column" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => formatFaNumber(v, 0)} />
                  <Tooltip
                    content={<ChartTooltip nameMap={{ pct: "درصد کامل بودن" }} />}
                  />
                  <Bar dataKey="pct" fill="rgb(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold">خطاها</div>
            <div className={cn("mt-3 rounded-2xl border border-border overflow-auto max-h-[260px] text-right")}>
              <table className="min-w-full text-[12px]">
                <thead className="bg-black/[0.02] dark:bg-white/[0.03] text-muted">
                  <tr>
                    <th className="px-3 py-2 border-b border-border">ستون</th>
                    <th className="px-3 py-2 border-b border-border">نوع</th>
                    <th className="px-3 py-2 border-b border-border">ردیف</th>
                    <th className="px-3 py-2 border-b border-border">پیام</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.errors.map((e, idx) => (
                    <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-3 py-2 border-b border-border">{e.column}</td>
                      <td className="px-3 py-2 border-b border-border">{errorTypeLabel(e.errorType)}</td>
                      <td className="px-3 py-2 border-b border-border">{formatFaNumber(e.rowIndex, 0)}</td>
                      <td className="px-3 py-2 border-b border-border">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
