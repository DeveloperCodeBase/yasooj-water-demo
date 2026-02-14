import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, BarChart3, Calendar, Database, Droplets, Play, ShieldAlert } from "lucide-react";
import { useAuth } from "../app/auth";
import { useFilters } from "../app/filters";
import { Page } from "../components/Page";
import { Card, CardBody, CardDescription, CardHeader, CardTitle, Button } from "../components/ui";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { RiskBadge, SeverityBadge } from "../components/badges";
import { EmptyState, Skeleton } from "../components/states";
import { Link } from "react-router-dom";
import { formatJalaliDateTime, formatJalaliMonth } from "../lib/dates";
import { ChartTooltip } from "../components/ChartTooltip";
import { auditActionLabel, confidenceLabel, entityLabel } from "../lib/labels";
import { formatFaNumber, formatFaPercentFromRatio } from "../lib/format";

type Kpi = { key: string; title: string; unit: string; value: number | null; delta: number | null };
type KpisRes = { kpis: Kpi[]; meta: any };

type TrendRes = { meta: any; series: Array<{ date: string; gwLevelAvg: number; trend: number }>; summary: any };
type ClimateRes = { meta: any; series: Array<{ date: string; precip: number; tmean: number }> };
type HeatmapRes = {
  meta: any;
  x: string[];
  y: Array<{ plainId: string; plainName: string }>;
  values: Array<{ plainId: string; month: string; risk: number }>;
  legend: any;
};
type TopRiskRes = { items: Array<{ wellId: string; wellCode: string; riskLevel: any; probCrossThreshold: number; latestLevel: number | null; dataQuality: number }> };
type ActivityRes = { items: Array<{ id: string; createdAt: string; action: string; entity: string; entityId: string | null; userEmail: string }> };
type NotifRes = { items: Array<{ id: string; title: string; body: string; severity: string; createdAt: string; readAt?: string }> };

type Forecast = { id: string; wellIds: string[]; modelId: string; scenarioId: string | null; horizonMonths: number; status: string; createdAt: string; confidence: string };
type ForecastList = { items: Forecast[] };
type FcSeries = { meta: any; series: Array<{ date: string; p10: number; p50: number; p90: number }>; confidence: string };

function heatColor(v: number) {
  const x = Math.max(0, Math.min(1, v));
  const r = Math.round(250 - x * 120);
  const g = Math.round(240 - x * 180);
  const b = Math.round(255 - x * 210);
  return `rgb(${r},${g},${b})`;
}

export function DashboardPage() {
  const auth = useAuth();
  const filters = useFilters();
  const f = filters.applied;
  const canAnalyst = auth.hasMinRole("analyst");

  const qKpis = useQuery({
    queryKey: ["analytics", "kpis", f, filters.appliedVersion],
    queryFn: () => auth.api<KpisRes>(`/analytics/kpis?plainId=${encodeURIComponent(f.plainId ?? "")}&from=${f.from}&to=${f.to}`),
  });

  const qTrend = useQuery({
    queryKey: ["analytics", "trend", f, filters.appliedVersion],
    queryFn: () => auth.api<TrendRes>(`/analytics/gw-level-trend?plainId=${encodeURIComponent(f.plainId ?? "")}&from=${f.from}&to=${f.to}&granularity=month`),
  });

  const qClimate = useQuery({
    queryKey: ["analytics", "climate", f, filters.appliedVersion],
    queryFn: () => auth.api<ClimateRes>(`/analytics/climate-combo?plainId=${encodeURIComponent(f.plainId ?? "")}&from=${f.from}&to=${f.to}&granularity=month`),
  });

  const qHeat = useQuery({
    queryKey: ["analytics", "heatmap", f.from, f.to, filters.appliedVersion],
    queryFn: () => auth.api<HeatmapRes>(`/analytics/risk-heatmap?from=${f.from}&to=${f.to}`),
  });

  const qTop = useQuery({
    queryKey: ["analytics", "top-risk", f.plainId, filters.appliedVersion],
    queryFn: () => auth.api<TopRiskRes>(`/analytics/top-risk-wells?plainId=${encodeURIComponent(f.plainId ?? "")}&limit=10`),
  });

  const qActivity = useQuery({
    queryKey: ["analytics", "activity"],
    queryFn: () => auth.api<ActivityRes>(`/analytics/activity?limit=15`),
  });

  const qNotifs = useQuery({
    queryKey: ["notifications", "preview"],
    queryFn: () => auth.api<NotifRes>(`/notifications?tab=unread&page=1&pageSize=6`),
  });

  const qForecasts = useQuery({
    queryKey: ["forecasts", "latest"],
    queryFn: () => auth.api<ForecastList>(`/forecasts?page=1&pageSize=5&sort=createdAt:desc`),
  });

  const forecast = (qForecasts.data?.items ?? []).find((x) => x.status === "ready") ?? qForecasts.data?.items?.[0] ?? null;
  const wellId = forecast?.wellIds?.[0] ?? null;

  const qFcSeries = useQuery({
    queryKey: ["forecast", "series", forecast?.id ?? "none", wellId ?? "none"],
    queryFn: () => auth.api<FcSeries>(`/forecasts/${encodeURIComponent(forecast!.id)}/series?wellId=${encodeURIComponent(wellId!)}`),
    enabled: Boolean(forecast?.id && wellId),
  });

  const fcBandSeries = React.useMemo(() => {
    const s = qFcSeries.data?.series ?? [];
    return s.map((p) => ({ ...p, band: Number((p.p90 - p.p10).toFixed(3)) }));
  }, [qFcSeries.data?.series]);

  const kpis = qKpis.data?.kpis ?? [];

  const rightPanel = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>اعلان‌های جدید</CardTitle>
          <Link to="/notifications" className="text-[12px] text-primary hover:underline">
            همه
          </Link>
        </CardHeader>
        <CardBody>
          {qNotifs.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : qNotifs.data?.items?.length ? (
            <div className="space-y-2">
              {qNotifs.data.items.slice(0, 6).map((n) => (
                <div key={n.id} className="rounded-xl border border-border bg-card/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold truncate">{n.title}</div>
                    <SeverityBadge severity={n.severity as any} />
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    <div className="max-h-[2.8em] overflow-hidden">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-muted">اعلان خوانده‌نشده‌ای وجود ندارد.</div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اقدام سریع</CardTitle>
          <div />
        </CardHeader>
        <CardBody>
          <div className="grid gap-2">
            <Link to="/forecasts/run" className="w-full">
              <Button variant="primary" className="w-full">
                <Play size={16} />
                اجرای پیش‌بینی
              </Button>
            </Link>
            {canAnalyst ? (
              <>
                <Link to="/alerts/new" className="w-full">
                  <Button className="w-full">
                    <ShieldAlert size={16} />
                    ساخت هشدار
                  </Button>
                </Link>
                <Link to="/datasets" className="w-full">
                  <Button className="w-full">
                    <Database size={16} />
                    دیتاست‌ها
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <Page
      title="داشبورد"
      crumbs={[{ label: "داشبورد" }]}
      rightPanel={rightPanel}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard title={kpis[0]?.title ?? "میانگین سطح آب زیرزمینی"} value={kpis[0]?.value ?? "—"} unit={kpis[0]?.unit} delta={kpis[0]?.delta} icon={<Droplets size={18} />} hint="میانگین ماه پایانی بازه" />
        <KpiCard title={kpis[1]?.title ?? "نرخ افت ماهانه"} value={kpis[1]?.value ?? "—"} unit={kpis[1]?.unit} delta={kpis[1]?.delta} icon={<BarChart3 size={18} />} />
        <KpiCard title={kpis[2]?.title ?? "چاه‌های پرریسک"} value={kpis[2]?.value ?? "—"} unit={kpis[2]?.unit} delta={kpis[2]?.delta} icon={<AlertTriangle size={18} />} />
        <KpiCard title={kpis[3]?.title ?? "کیفیت داده"} value={kpis[3]?.value ?? "—"} unit={kpis[3]?.unit} delta={kpis[3]?.delta} icon={<Activity size={18} />} />
        <KpiCard title={kpis[4]?.title ?? "شاخص خشکسالی"} value={kpis[4]?.value ?? "—"} unit={kpis[4]?.unit} delta={kpis[4]?.delta} icon={<Calendar size={18} />} />
        <KpiCard title={kpis[5]?.title ?? "هشدارهای ۳۰ روز اخیر"} value={kpis[5]?.value ?? "—"} unit={kpis[5]?.unit} delta={kpis[5]?.delta} icon={<ShieldAlert size={18} />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>روند میانگین سطح آب زیرزمینی</CardTitle>
              <CardDescription>به همراه خط روند</CardDescription>
            </div>
            <div />
          </CardHeader>
          <CardBody>
            <div className="h-[280px] w-full">
              {qTrend.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : qTrend.data?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={qTrend.data.series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatJalaliMonth(String(v))} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(v) => formatJalaliMonth(String(v))}
                          nameMap={{ gwLevelAvg: "سطح آب (میانگین)", trend: "خط روند" }}
                        />
                      }
                    />
                    <Line type="monotone" dataKey="gwLevelAvg" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="trend" stroke="rgba(4,205,159,0.9)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="داده‌ای در این بازه وجود ندارد" />
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>بارش در برابر دما</CardTitle>
              <CardDescription>نمودار ترکیبی (ماهانه)</CardDescription>
            </div>
            <div />
          </CardHeader>
          <CardBody>
            <div className="h-[280px] w-full">
              {qClimate.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : qClimate.data?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={qClimate.data.series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatJalaliMonth(String(v))} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(v) => formatJalaliMonth(String(v))}
                          nameMap={{ precip: "بارش (میلی‌متر)", tmean: "دمای میانگین (°C)" }}
                        />
                      }
                    />
                    <Bar yAxisId="left" dataKey="precip" fill="rgba(18,92,255,0.35)" />
                    <Line yAxisId="right" type="monotone" dataKey="tmean" stroke="rgb(var(--primary2))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="داده‌ای وجود ندارد" />
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>پیش‌بینی با باند عدم‌قطعیت</CardTitle>
              <CardDescription>{forecast ? `${forecast.id} · اعتماد: ${confidenceLabel(forecast.confidence)}` : "بدون پیش‌بینی"}</CardDescription>
            </div>
            {forecast ? (
              <Link to={`/forecasts/${forecast.id}`} className="text-[12px] text-primary hover:underline">
                مشاهده
              </Link>
            ) : (
              <div />
            )}
          </CardHeader>
          <CardBody>
            <div className="h-[280px] w-full">
              {qFcSeries.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : qFcSeries.data?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fcBandSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatJalaliMonth(String(v))} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(v) => formatJalaliMonth(String(v))}
                          nameMap={{ p10: "صدک ۱۰", p50: "میانه", p90: "صدک ۹۰", band: "باند" }}
                          hideKeys={["band"]}
                        />
                      }
                    />
                    <Area type="monotone" dataKey="p10" stackId="1" stroke="none" fill="transparent" dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="band" stackId="1" stroke="rgba(18,92,255,0.25)" fill="rgba(18,92,255,0.18)" dot={false} />
                    <Line type="monotone" dataKey="p10" stroke="rgba(18,92,255,0.45)" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="p90" stroke="rgba(18,92,255,0.45)" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="p50" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="سری پیش‌بینی موجود نیست" />
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>ماتریس ریسک (ماه x دشت)</CardTitle>
              <CardDescription>نقشه حرارتی ساده</CardDescription>
            </div>
            <div />
          </CardHeader>
          <CardBody>
            {qHeat.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : qHeat.data?.x?.length && qHeat.data?.y?.length ? (
              <div className="overflow-auto">
                <div className="min-w-[760px]">
                  <div className="grid" style={{ gridTemplateColumns: `220px repeat(${qHeat.data.x.length}, 1fr)` }}>
                    <div className="text-[12px] text-muted px-2 py-2">دشت</div>
                    {qHeat.data.x.map((m) => (
                      <div key={m} className="text-[11px] text-muted px-2 py-2 border-b border-border whitespace-nowrap">
                        {formatJalaliMonth(`${m}-01`)}
                      </div>
                    ))}
                    {qHeat.data.y.map((row) => (
                      <React.Fragment key={row.plainId}>
                        <div className="text-[12px] px-2 py-2 border-b border-border whitespace-nowrap">{row.plainName}</div>
                        {qHeat.data!.x.map((m) => {
                          const v = qHeat.data!.values.find((x) => x.plainId === row.plainId && x.month === m)?.risk ?? 0;
                          return (
                            <div
                              key={m}
                              className="border-b border-border px-2 py-2 text-[11px]"
                              style={{ background: heatColor(v) }}
                              title={`${row.plainName} · ${formatJalaliMonth(`${m}-01`)} · ریسک: ${formatFaNumber(v, 2)}`}
                            >
                              {formatFaNumber(v, 2)}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="داده‌ای وجود ندارد" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DataTable
          title="۱۰ چاه پرریسک"
          loading={qTop.isLoading}
          data={qTop.data?.items ?? []}
          columns={[
            { header: "کد چاه", accessorKey: "wellCode", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
            { header: "ریسک", accessorKey: "riskLevel", cell: (ctx) => <RiskBadge level={ctx.getValue() as any} /> },
            {
              header: "احتمال عبور",
              accessorKey: "probCrossThreshold",
              cell: (ctx) => formatFaPercentFromRatio(ctx.getValue()),
            },
            { header: "سطح فعلی", accessorKey: "latestLevel" },
            { header: "کیفیت", accessorKey: "dataQuality" },
            {
              header: "",
              accessorKey: "wellId",
              cell: (ctx) => (
                <Link to={`/wells/${String(ctx.getValue())}`} className="text-primary hover:underline text-[12px]">
                  مشاهده
                </Link>
              ),
            },
          ]}
          emptyTitle="چاهی مطابق فیلترها یافت نشد"
        />

        <Card>
          <CardHeader>
            <CardTitle>فعالیت‌های اخیر</CardTitle>
            <div />
          </CardHeader>
          <CardBody>
            {qActivity.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : qActivity.data?.items?.length ? (
              <div className="space-y-2">
                {qActivity.data.items.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-card/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold truncate">{auditActionLabel(a.action)}</div>
                      <div className="text-[11px] text-muted">{formatJalaliDateTime(a.createdAt)}</div>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      <span className="font-semibold">{entityLabel(a.entity)}</span>
                      <span className="opacity-70"> · </span>
                      <span className="font-mono">{a.entity}</span>
                      {a.entityId ? <span className="opacity-70"> · {a.entityId}</span> : null}
                      <span className="opacity-70"> · {a.userEmail}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="فعالیتی ثبت نشده" />
            )}
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
