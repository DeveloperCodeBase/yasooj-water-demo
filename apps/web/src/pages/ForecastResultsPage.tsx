import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown, FileText, SplitSquareVertical } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Select } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { RiskBadge, StatusBadge } from "../components/badges";
import { EmptyState, Skeleton } from "../components/states";
import { ChartTooltip } from "../components/ChartTooltip";
import { downloadText } from "../lib/download";
import { toCsv } from "../lib/csv";
import { formatJalaliDateTime, formatJalaliMonth } from "../lib/dates";
import { confidenceLabel, toFaDigits } from "../lib/labels";
import { formatFaNumber, formatFaPercentFromRatio } from "../lib/format";

type Forecast = {
  id: string;
  scenarioId: string | null;
  modelId: string;
  wellIds: string[];
  horizonMonths: number;
  status: "running" | "ready" | "failed";
  createdAt: string;
  createdByUserId: string;
  confidence: "low" | "medium" | "high";
};

type WellResult = { forecastId: string; wellId: string; wellCode: string; p50FinalLevel: number; probCrossThreshold: number; expectedDropRate: number; riskLevel: "low" | "medium" | "high" | "critical" };
type ResultsRes = { items: WellResult[] };

type SeriesRes = { meta: any; series: Array<{ date: string; p10: number; p50: number; p90: number }>; metrics: any; confidence: string };
type ForecastListRes = { items: Forecast[] };

type ModelMetricsRes = { modelId: string; metrics: any; residuals: any[]; featureImportance: Array<{ feature: string; importance: number }> };

function openPrintHtml(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=920,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 50);
}

function riskLabel(level: string) {
  const s = String(level ?? "").toLowerCase();
  if (s === "critical") return "بحرانی";
  if (s === "high") return "زیاد";
  if (s === "medium") return "متوسط";
  if (s === "low") return "کم";
  return level;
}

export function ForecastResultsPage() {
  const auth = useAuth();
  const { id } = useParams();

  const qFc = useQuery({
    queryKey: ["forecast", id],
    queryFn: () => auth.api<Forecast>(`/forecasts/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
  const fc = qFc.data;

  const [wellId, setWellId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!fc) return;
    setWellId((prev) => prev ?? fc.wellIds?.[0] ?? null);
  }, [fc]);

  const qResults = useQuery({
    queryKey: ["forecast", id, "results"],
    queryFn: () => auth.api<ResultsRes>(`/forecasts/${encodeURIComponent(id!)}/results`),
    enabled: !!id,
  });

  const qSeries = useQuery({
    queryKey: ["forecast", id, "series", wellId],
    queryFn: () => auth.api<SeriesRes>(`/forecasts/${encodeURIComponent(id!)}/series?wellId=${encodeURIComponent(wellId!)}`),
    enabled: !!id && !!wellId,
  });

  const seriesBand = React.useMemo(() => {
    const s = qSeries.data?.series ?? [];
    return s.map((p) => ({ ...p, band: Number((p.p90 - p.p10).toFixed(3)) }));
  }, [qSeries.data?.series]);

  const qAllForecasts = useQuery({
    queryKey: ["forecasts", "for-compare"],
    queryFn: () => auth.api<ForecastListRes>(`/forecasts?page=1&pageSize=50&sort=createdAt:desc`),
    enabled: !!id,
  });
  const compareChoices = (qAllForecasts.data?.items ?? []).filter((x) => x.id !== id && x.status === "ready");
  const [compareId, setCompareId] = React.useState<string>("");

  const qCompareSeries = useQuery({
    queryKey: ["forecast", "compare", compareId, "series", wellId],
    queryFn: () => auth.api<SeriesRes>(`/forecasts/${encodeURIComponent(compareId)}/series?wellId=${encodeURIComponent(wellId!)}`),
    enabled: !!compareId && !!wellId,
    retry: false,
  });

  const qModelMetrics = useQuery({
    queryKey: ["model", fc?.modelId, "metrics"],
    queryFn: () => auth.api<ModelMetricsRes>(`/models/${encodeURIComponent(fc!.modelId)}/metrics`),
    enabled: !!fc?.modelId,
  });

  const results = qResults.data?.items ?? [];
  const topRisk = [...results].sort((a, b) => b.probCrossThreshold - a.probCrossThreshold).slice(0, 10);

  const exportResultsCsv = () => {
    if (!results.length) return;
    const csv = toCsv(results as any[], [
      { key: "wellCode" as any, label: "کد چاه" },
      { key: "p50FinalLevel" as any, label: "سطح نهایی (میانه)" },
      { key: "probCrossThreshold" as any, label: "احتمال عبور از آستانه" },
      { key: "expectedDropRate" as any, label: "نرخ افت مورد انتظار" },
      { key: "riskLevel" as any, label: "ریسک" },
    ]);
    downloadText(`forecast_${id}_results.csv`, csv, "text/csv;charset=utf-8");
  };

  const exportPdf = () => {
    if (!fc) return;
    const nowFa = formatJalaliDateTime(new Date().toISOString());
    const scenarioText = fc.scenarioId ? `سناریو: ${fc.scenarioId}` : "سناریو: اقلیم فعلی";
    const html = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>گزارش پیش‌بینی ${fc.id}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; background: #f7f7fb; color: #111; padding: 24px; }
      .card { background: #fff; border: 1px solid #e9e9ef; border-radius: 16px; padding: 18px 20px; max-width: 980px; margin: 0 auto; }
      h1 { margin: 0 0 6px; font-size: 20px; }
      .muted { color: #555; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { border-bottom: 1px solid #eee; padding: 8px 6px; text-align: right; }
      th { color: #444; font-weight: 700; }
      .footer { margin-top: 14px; font-size: 12px; color: #555; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>نتایج پیش‌بینی · ${fc.id}</h1>
      <div class="muted">${nowFa} · مدل: ${fc.modelId} · ${scenarioText} · افق: ${toFaDigits(String(fc.horizonMonths))} ماه</div>
      <table>
        <thead>
          <tr>
            <th>کد چاه</th>
            <th>سطح نهایی (میانه)</th>
            <th>احتمال عبور</th>
            <th>نرخ افت</th>
            <th>ریسک</th>
          </tr>
        </thead>
        <tbody>
          ${(results.slice(0, 20)).map((r) => `<tr><td>${r.wellCode}</td><td>${toFaDigits(String(r.p50FinalLevel))}</td><td>${toFaDigits(String(Math.round(r.probCrossThreshold * 100)))}٪</td><td>${toFaDigits(String(r.expectedDropRate))}</td><td>${riskLabel(r.riskLevel)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">مالکیت و حقوق این سامانه متعلق به شرکت شبکه هوشمند ابتکار ویستا است.</div>
    </div>
  </body>
</html>`;
    openPrintHtml(html);
  };

  const downloadSeriesCsv = async (wellId: string, wellCode: string) => {
    try {
      const s = await auth.api<SeriesRes>(`/forecasts/${encodeURIComponent(id!)}/series?wellId=${encodeURIComponent(wellId)}`);
      const csv = toCsv(s.series as any[], [
        { key: "date" as any, label: "تاریخ" },
        { key: "p10" as any, label: "صدک ۱۰" },
        { key: "p50" as any, label: "میانه" },
        { key: "p90" as any, label: "صدک ۹۰" },
      ]);
      downloadText(`forecast_${id}_${wellCode}.csv`, csv, "text/csv;charset=utf-8");
    } catch {
      toast.error("دانلود سری ناموفق بود");
    }
  };

  const saveAsReport = async () => {
    if (!fc) return;
    try {
      const res = await auth.api<{ reportId: string; job: { id: string } }>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          type: "technical",
          title: `گزارش پیش‌بینی · ${fc.id}`,
          sections: ["forecast_charts", "risk_table", "data_quality", "alerts_summary"],
          scope: { forecastId: fc.id },
        }),
      });
      toast.success("گزارش در حال تولید است");
      return res;
    } catch {
      toast.error("خطا در ساخت گزارش");
      return null;
    }
  };

  const rightPanel = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>توضیح‌پذیری</CardTitle>
          <Badge tone="info">{fc?.confidence ? confidenceLabel(fc.confidence) : "—"}</Badge>
        </CardHeader>
        <CardBody>
              {qModelMetrics.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : qModelMetrics.data?.featureImportance?.length ? (
                <div className="space-y-2">
                  {qModelMetrics.data.featureImportance.slice(0, 8).map((f) => (
                    <div key={f.feature} className="flex items-center justify-between gap-3 text-[13px]">
                      <div className="truncate">{f.feature}</div>
                      <div className="text-muted">{formatFaNumber(f.importance, 2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="اطلاعاتی موجود نیست" />
          )}
          <div className="mt-4 text-[12px] text-muted">
            اعتماد مدل بر اساس میانگین کیفیت داده چاه‌های انتخابی (دمو).
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مقایسه</CardTitle>
          <div />
        </CardHeader>
        <CardBody>
          <LabelRow label="پیش‌بینی دوم">
            <Select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              <option value="">بدون مقایسه</option>
              {compareChoices.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} · {f.scenarioId ?? "اقلیم فعلی"}
                </option>
              ))}
            </Select>
          </LabelRow>
          <div className="mt-3 text-[12px] text-muted">
            در صورت نبودن چاه در پیش‌بینی دوم، نمودار مقایسه نمایش داده نمی‌شود.
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <Page
      title="نتایج پیش‌بینی"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "پیش‌بینی‌ها", to: "/forecasts" },
        { label: id ?? "" },
      ]}
      rightPanel={rightPanel}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={exportPdf} disabled={!fc}>
            <FileDown size={16} />
            خروجی پی‌دی‌اف
          </Button>
          <Button onClick={exportResultsCsv} disabled={!results.length}>
            <FileDown size={16} />
            خروجی سی‌اس‌وی
          </Button>
          <Button
            onClick={async () => {
              const r = await saveAsReport();
              if (r?.reportId) toast("به صفحه گزارش‌ها مراجعه کنید.", { duration: 3500 });
            }}
            disabled={!fc}
          >
            <FileText size={16} />
            ذخیره به عنوان گزارش
          </Button>
        </div>
      }
    >
      {!fc ? (
        <Card>
          <CardBody>{qFc.isLoading ? <Skeleton className="h-10 w-full" /> : <EmptyState title="پیش‌بینی یافت نشد" />}</CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{fc.id}</CardTitle>
                <CardDescription>
                  {fc.scenarioId ?? "اقلیم فعلی"} · {fc.modelId} · {toFaDigits(String(fc.horizonMonths))} ماه · {confidenceLabel(fc.confidence)}
                </CardDescription>
              </div>
              <StatusBadge status={fc.status} />
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 md:grid-cols-3 items-end">
                <div className="md:col-span-1">
                  <div className="text-[12px] text-muted">انتخاب چاه</div>
                  <Select value={wellId ?? ""} onChange={(e) => setWellId(e.target.value || null)}>
                    {fc.wellIds.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2 text-[12px] text-muted">
                  نمودارها و جدول‌ها بر اساس داده‌های دمو تولید می‌شوند.
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>پیش‌بینی + عدم‌قطعیت</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {qSeries.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : qSeries.data?.series?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={seriesBand}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatJalaliMonth(String(v))} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              labelFormatter={(v) => formatJalaliMonth(String(v))}
                              nameMap={{ p10: "صدک ۱۰", p50: "میانه", p90: "صدک ۹۰" }}
                              hideKeys={["band"]}
                            />
                          }
                        />
                        <Area type="monotone" dataKey="p10" stackId="1" stroke="none" fill="transparent" dot={false} isAnimationActive={false} />
                        <Area type="monotone" dataKey="band" stackId="1" stroke="rgba(18,92,255,0.25)" fill="rgba(18,92,255,0.18)" dot={false} />
                        <Line type="monotone" dataKey="p10" stroke="rgba(18,92,255,0.55)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="p50" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="p90" stroke="rgba(18,92,255,0.55)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="سری در دسترس نیست" />
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مقایسه سناریو/پیش‌بینی</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {compareId ? (
                    qCompareSeries.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : qCompareSeries.data?.series?.length && qSeries.data?.series?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={qSeries.data.series.map((p, idx) => ({
                            date: p.date,
                            p50_a: p.p50,
                            p50_b: qCompareSeries.data!.series[idx]?.p50 ?? null,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatJalaliMonth(String(v))} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                          <Tooltip
                            content={
                              <ChartTooltip
                                labelFormatter={(v) => formatJalaliMonth(String(v))}
                                nameMap={{ p50_a: "میانه این پیش‌بینی", p50_b: "میانه پیش‌بینی دوم" }}
                              />
                            }
                          />
                          <Line type="monotone" dataKey="p50_a" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="p50_b" stroke="rgb(var(--primary2))" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="مقایسه ممکن نیست" description="چاه در پیش‌بینی دوم وجود ندارد." />
                    )
                  ) : (
                    <EmptyState title="برای مقایسه یک پیش‌بینی انتخاب کنید" />
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>رتبه‌بندی ریسک</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {results.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topRisk.map((r) => ({ well: r.wellCode, prob: Math.round(r.probCrossThreshold * 100) }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="well" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => formatFaNumber(v, 0)} />
                        <Tooltip content={<ChartTooltip nameMap={{ prob: "احتمال عبور (٪)" }} />} />
                        <Bar dataKey="prob" fill="rgba(235,55,80,0.55)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="داده‌ای وجود ندارد" />
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>عوامل اثرگذار (اهمیت ویژگی‌ها)</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {qModelMetrics.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : qModelMetrics.data?.featureImportance?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...qModelMetrics.data.featureImportance]
                          .sort((a, b) => b.importance - a.importance)
                          .slice(0, 10)}
                        layout="vertical"
                        margin={{ right: 90, left: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <YAxis type="category" dataKey="feature" orientation="right" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip content={<ChartTooltip nameMap={{ importance: "اهمیت" }} />} />
                        <Bar dataKey="importance" fill="rgba(4,205,159,0.55)" radius={[0, 10, 10, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="داده‌ای وجود ندارد" />
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5">
            <DataTable
              title="نتایج چاه‌ها"
              loading={qResults.isLoading}
              data={results}
              columns={[
                { id: "wellCode", header: "کد چاه", accessorKey: "wellCode", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
                { id: "p50FinalLevel", header: "سطح نهایی (میانه)", accessorKey: "p50FinalLevel" },
                {
                  id: "probCrossThreshold",
                  header: "احتمال عبور",
                  accessorKey: "probCrossThreshold",
                  cell: (ctx) => formatFaPercentFromRatio(ctx.getValue()),
                },
                { id: "expectedDropRate", header: "نرخ افت", accessorKey: "expectedDropRate" },
                { id: "riskLevel", header: "ریسک", accessorKey: "riskLevel", cell: (ctx) => <RiskBadge level={ctx.getValue() as any} /> },
                {
                  id: "actions",
                  header: "اقدام",
                  accessorKey: "wellId",
                  cell: (ctx) => {
                    const wId = String(ctx.getValue());
                    const row = ctx.row.original as any as WellResult;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/wells/${wId}`} className="text-primary hover:underline text-[12px]">
                          مشاهده چاه
                        </Link>
                        <button className="text-[12px] text-muted hover:text-text inline-flex items-center gap-2" onClick={() => void downloadSeriesCsv(wId, row.wellCode)}>
                          <SplitSquareVertical size={16} />
                          دانلود سری
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              emptyTitle="داده‌ای وجود ندارد"
              emptyDescription="ابتدا یک پیش‌بینی اجرا کنید."
            />
          </div>
        </>
      )}
    </Page>
  );
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
