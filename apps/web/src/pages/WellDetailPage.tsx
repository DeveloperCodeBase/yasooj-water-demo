import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown, Pin, Plus, Sparkles } from "lucide-react";
import { useAuth } from "../app/auth";
import { useFilters } from "../app/filters";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select, Textarea } from "../components/ui";
import { RiskBadge, StatusBadge } from "../components/badges";
import { EmptyState, Skeleton } from "../components/states";
import { ChartTooltip } from "../components/ChartTooltip";
import { downloadText } from "../lib/download";
import { toCsv } from "../lib/csv";
import { cn } from "../lib/cn";
import { formatJalaliDate, formatJalaliDateTime, formatJalaliMonth } from "../lib/dates";
import { confidenceLabel } from "../lib/labels";
import { formatFaNumber, formatFaPercentFromRatio } from "../lib/format";

type Well = {
  id: string;
  code: string;
  name: string;
  plainId: string;
  plainName: string | null;
  aquiferId: string;
  aquiferName: string | null;
  status: "active" | "inactive";
  tags?: string[];
  depthM: number;
  lat: number;
  lon: number;
  monitoringFrequency: string;
  latestGwLevelM: number | null;
  change30dM: number | null;
  dataQualityScore: number;
  riskScore: number;
  riskLevel: any;
  lastUpdate: string;
  pinned?: boolean;
  miniKpi: { latestLevel: number | null; trendSlopePerYear: number; anomaliesCount: number };
};

type TsRes = {
  meta: any;
  series: Array<{ date: string; gwLevelM: number | null; precipMm: number; tmeanC: number; flags: { anomaly?: boolean; missing?: boolean } }>;
};

type QualityRes = {
  wellId: string;
  completeness: number;
  score: number;
  missingPeriods: Array<{ from: string; to: string; months: number }>;
  outliers: Array<{ date: string; value: number | null }>;
};

type FcList = { items: Array<{ id: string; scenarioId: string; modelId: string; horizonMonths: number; createdAt: string; status: string; confidence: string }> };
type NotesRes = { items: Array<{ id: string; authorUserId: string; body: string; createdAt: string }> };

function openPrintHtml(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 50);
}

export function WellDetailPage() {
  const auth = useAuth();
  const { id } = useParams();
  const filters = useFilters();

  const [tab, setTab] = React.useState<"overview" | "timeseries" | "quality" | "forecasts" | "notes">("overview");
  const [granularity, setGranularity] = React.useState<"month" | "day">("month");
  const [smoothing, setSmoothing] = React.useState(false);
  const [showAnomalies, setShowAnomalies] = React.useState(true);

  const qWell = useQuery({
    queryKey: ["well", id],
    queryFn: () => auth.api<Well>(`/wells/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });

  const qTs = useQuery({
    queryKey: ["well", id, "ts", filters.applied, granularity, smoothing, showAnomalies],
    queryFn: () => {
      const f = filters.applied;
      const qp = new URLSearchParams();
      qp.set("from", f.from);
      qp.set("to", f.to);
      qp.set("granularity", granularity);
      qp.set("smoothing", String(smoothing));
      qp.set("showAnomalies", String(showAnomalies));
      return auth.api<TsRes>(`/wells/${encodeURIComponent(id!)}/timeseries?${qp.toString()}`);
    },
    enabled: !!id && tab === "timeseries",
  });

  const qQuality = useQuery({
    queryKey: ["well", id, "quality"],
    queryFn: () => auth.api<QualityRes>(`/wells/${encodeURIComponent(id!)}/quality`),
    enabled: !!id && tab === "quality",
  });

  const qForecasts = useQuery({
    queryKey: ["well", id, "forecasts"],
    queryFn: () => auth.api<FcList>(`/wells/${encodeURIComponent(id!)}/forecasts`),
    enabled: !!id && tab === "forecasts",
  });

  const qNotes = useQuery({
    queryKey: ["well", id, "notes"],
    queryFn: () => auth.api<NotesRes>(`/wells/${encodeURIComponent(id!)}/notes`),
    enabled: !!id && tab === "notes",
  });

  const well = qWell.data;

  const canNote = auth.hasMinRole("analyst");
  const [noteBody, setNoteBody] = React.useState("");

  const exportCsv = () => {
    const series = qTs.data?.series ?? [];
    if (!series.length) return;
    const csv = toCsv(
      series.map((p) => ({ ...p, flags: JSON.stringify(p.flags ?? {}) })) as any[],
      [
        { key: "date" as any, label: "تاریخ" },
        { key: "gwLevelM" as any, label: "سطح آب (متر)" },
        { key: "precipMm" as any, label: "بارش (میلی‌متر)" },
        { key: "tmeanC" as any, label: "دمای میانگین (°C)" },
        { key: "flags" as any, label: "برچسب‌ها" },
      ],
    );
    downloadText(`${well?.code ?? "well"}_timeseries.csv`, csv, "text/csv;charset=utf-8");
  };

  const exportPdf = () => {
    if (!well) return;
    const nowFa = formatJalaliDateTime(new Date().toISOString());
    const riskLabel =
      well.riskLevel === "critical"
        ? "بحرانی"
        : well.riskLevel === "high"
          ? "زیاد"
          : well.riskLevel === "medium"
            ? "متوسط"
            : "کم";
    const html = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${well.code} - ${well.name}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; background: #f7f7fb; color: #111; padding: 24px; }
      .card { background: #fff; border: 1px solid #e9e9ef; border-radius: 16px; padding: 18px 20px; max-width: 920px; margin: 0 auto; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      .muted { color: #555; font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-top: 12px; }
      .k { font-size: 12px; color: #666; }
      .v { font-size: 13px; font-weight: 600; }
      .footer { margin-top: 14px; font-size: 12px; color: #555; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${well.code} · ${well.name}</h1>
      <div class="muted">${nowFa}</div>
      <div class="grid">
        <div><div class="k">دشت</div><div class="v">${well.plainName ?? well.plainId}</div></div>
        <div><div class="k">آبخوان</div><div class="v">${well.aquiferName ?? well.aquiferId}</div></div>
        <div><div class="k">آخرین سطح (متر)</div><div class="v">${well.latestGwLevelM ?? "-"}</div></div>
        <div><div class="k">تغییر ۳۰ روز (متر)</div><div class="v">${well.change30dM ?? "-"}</div></div>
        <div><div class="k">ریسک</div><div class="v">${riskLabel}</div></div>
        <div><div class="k">کیفیت داده</div><div class="v">${well.dataQualityScore}</div></div>
      </div>
      <div class="footer">مالکیت و حقوق این سامانه متعلق به شرکت شبکه هوشمند ابتکار ویستا است.</div>
    </div>
  </body>
</html>`;
    openPrintHtml(html);
  };

  const attachmentsKey = `well_attachments_${id}`;
  const [attachments, setAttachments] = React.useState<Array<{ name: string; size: number; addedAt: string }>>(() => {
    try {
      const raw = localStorage.getItem(attachmentsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(attachmentsKey, JSON.stringify(attachments.slice(-20)));
    } catch {
      // ignore
    }
  }, [attachments, attachmentsKey]);

  return (
    <Page
      title={
        well ? (
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="truncate">
              {well.name} <span className="text-muted">({well.code})</span>
            </div>
            <StatusBadge status={well.status} />
          </div>
        ) : (
          "جزئیات چاه"
        )
      }
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "چاه‌ها", to: "/wells" },
        { label: well?.code ?? "جزئیات" },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={async () => {
              if (!id) return;
              const res = await auth.api<{ pinned: boolean }>(`/wells/${encodeURIComponent(id)}/pin`, { method: "POST" });
              toast.success(res.pinned ? "پین شد" : "از پین خارج شد");
              await qWell.refetch();
            }}
            disabled={!id}
          >
            <Pin size={16} />
            پین
          </Button>
          <Button onClick={() => setTab("notes")} disabled={!id}>
            <Plus size={16} />
            یادداشت‌ها
          </Button>
          <Button onClick={exportPdf} disabled={!well}>
            <FileDown size={16} />
            خروجی پی‌دی‌اف
          </Button>
          <Button onClick={exportCsv} disabled={!qTs.data?.series?.length}>
            <FileDown size={16} />
            خروجی سی‌اس‌وی
          </Button>
        </div>
      }
    >
      {!well ? (
        <Card>
          <CardBody>{qWell.isLoading ? <Skeleton className="h-10 w-full" /> : <EmptyState title="چاه یافت نشد" />}</CardBody>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button className={tab === "overview" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("overview")}>
              نمای کلی
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "timeseries" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("timeseries")}>
              سری زمانی
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "quality" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("quality")}>
              کیفیت
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "forecasts" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("forecasts")}>
              پیش‌بینی‌ها
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "notes" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("notes")}>
              یادداشت‌ها و فایل‌ها
            </button>
          </div>

          {tab === "overview" ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>اطلاعات</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoRow k="دشت" v={well.plainName ?? well.plainId} />
                    <InfoRow k="آبخوان" v={well.aquiferName ?? well.aquiferId} />
                    <InfoRow k="عمق (متر)" v={well.depthM} />
                    <InfoRow k="مختصات" v={`${well.lat}, ${well.lon}`} />
                    <InfoRow k="تناوب پایش" v={well.monitoringFrequency === "monthly" ? "ماهانه" : well.monitoringFrequency} />
                    <InfoRow k="آخرین بروزرسانی" v={formatJalaliDateTime(well.lastUpdate)} />
                  </div>
                  <div className="mt-4">
                    <Label>برچسب‌ها</Label>
                    <div className="mt-2 text-[13px] text-muted">{(well.tags ?? []).join("، ") || "بدون برچسب"}</div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>شاخص‌های کوچک</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    <MiniKpi label="آخرین سطح" value={well.miniKpi.latestLevel ?? "—"} />
                    <MiniKpi label="شیب سالانه" value={well.miniKpi.trendSlopePerYear} />
                    <MiniKpi label="تعداد ناهنجاری‌ها" value={well.miniKpi.anomaliesCount} />
                    <div className="pt-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] text-muted">ریسک</div>
                        <RiskBadge level={well.riskLevel} />
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[12px] text-muted">
                          <span>کیفیت داده</span>
                          <span>{well.dataQualityScore}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, well.dataQualityScore))}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === "timeseries" ? (
            <div className="mt-5 space-y-5">
              <Card>
                <CardBody>
                  <div className="grid gap-3 md:grid-cols-12 items-end">
                    <div className="md:col-span-3">
                      <Label>تفکیک</Label>
                    <Select value={granularity} onChange={(e) => setGranularity(e.target.value as any)}>
                      <option value="month">ماهانه</option>
                      <option value="day">روزانه (دمو)</option>
                    </Select>
                    </div>
                    <div className={cn("md:col-span-3 flex items-center gap-2 text-[13px] flex-wrap")}>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                          checked={smoothing}
                          onChange={(e) => setSmoothing(e.target.checked)}
                        />
                        <span>هموارسازی</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                          checked={showAnomalies}
                          onChange={(e) => setShowAnomalies(e.target.checked)}
                        />
                        <span>نمایش ناهنجاری‌ها</span>
                      </label>
                    </div>
                    <div className="md:col-span-6 text-[12px] text-muted">
                      بازه زمانی از فیلترهای سراسری گرفته می‌شود.
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>سطح آب زیرزمینی</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="h-[300px] w-full">
                    {qTs.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : qTs.data?.series?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={qTs.data.series}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => (granularity === "month" ? formatJalaliMonth(String(v)) : formatJalaliDate(String(v)))}
                          />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                          <Tooltip
                            content={
                              <ChartTooltip
                                labelFormatter={(v) => (granularity === "month" ? formatJalaliMonth(String(v)) : formatJalaliDate(String(v)))}
                                nameMap={{ gwLevelM: "سطح آب (متر)" }}
                              />
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="gwLevelM"
                            stroke="rgb(var(--primary))"
                            strokeWidth={2}
                            dot={(p: any) => {
                              const isAnom = Boolean(p?.payload?.flags?.anomaly);
                              if (!isAnom) return <circle cx={p.cx} cy={p.cy} r={0} fill="transparent" />;
                              return <circle cx={p.cx} cy={p.cy} r={4} fill="rgb(var(--danger))" stroke="white" strokeWidth={1} />;
                            }}
                            connectNulls={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="داده‌ای وجود ندارد" />
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>بارش و دما</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="h-[300px] w-full">
                    {qTs.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : qTs.data?.series?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={qTs.data.series}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => (granularity === "month" ? formatJalaliMonth(String(v)) : formatJalaliDate(String(v)))}
                          />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                          <Tooltip
                            content={
                              <ChartTooltip
                                labelFormatter={(v) => (granularity === "month" ? formatJalaliMonth(String(v)) : formatJalaliDate(String(v)))}
                                nameMap={{ precipMm: "بارش (میلی‌متر)", tmeanC: "دمای میانگین (°C)" }}
                              />
                            }
                          />
                          <Bar yAxisId="left" dataKey="precipMm" fill="rgba(18,92,255,0.35)" />
                          <Line yAxisId="right" type="monotone" dataKey="tmeanC" stroke="rgb(var(--primary2))" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="داده‌ای وجود ندارد" />
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === "quality" ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>کامل بودن و کیفیت</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  {qQuality.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : qQuality.data ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-[12px] text-muted">
                          <span>کامل بودن</span>
                          <span>{formatFaPercentFromRatio(qQuality.data.completeness, 0)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.round(qQuality.data.completeness * 100)}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] text-muted">امتیاز کیفیت</div>
                        <Badge tone="info">{formatFaNumber(qQuality.data.score, 0)}</Badge>
                      </div>
                      <div className="text-[12px] text-muted">
                        ناهنجاری‌ها و بازه‌های داده‌ی گمشده بر اساس داده‌های دمو ساخته شده‌اند.
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="داده‌ای وجود ندارد" />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>دوره‌های داده‌ی گمشده</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  {qQuality.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : qQuality.data?.missingPeriods?.length ? (
                    <div className="space-y-2">
                      {qQuality.data.missingPeriods.map((p, idx) => (
                        <div key={idx} className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              {formatJalaliMonth(p.from)} → {formatJalaliMonth(p.to)}
                            </div>
                            <Badge tone="warning">{formatFaNumber(p.months, 0)} ماه</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="دوره قابل توجهی وجود ندارد" />
                  )}
                </CardBody>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>داده‌های پرت</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  {qQuality.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : qQuality.data?.outliers?.length ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      {qQuality.data.outliers.slice(0, 18).map((o, idx) => (
                        <div key={idx} className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
                          <div className="text-[12px] text-muted">{formatJalaliDate(o.date)}</div>
                          <div className="mt-1 font-semibold">{o.value === null || o.value === undefined ? "—" : formatFaNumber(o.value)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="داده پرت ندارد" />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === "forecasts" ? (
            <div className="mt-5">
              <Card>
                <CardHeader>
                  <CardTitle>پیش‌بینی‌های مرتبط</CardTitle>
                  <Link to="/forecasts" className="text-[12px] text-primary hover:underline">
                    همه پیش‌بینی‌ها
                  </Link>
                </CardHeader>
                <CardBody>
                  {qForecasts.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : qForecasts.data?.items?.length ? (
                    <div className="space-y-2">
                      {qForecasts.data.items.map((f) => (
                        <div key={f.id} className="rounded-xl border border-border bg-card/60 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] font-semibold">{f.id}</div>
                            <StatusBadge status={f.status} />
                          </div>
                          <div className="mt-1 text-[12px] text-muted">
                            {f.modelId} · {f.scenarioId ?? "اقلیم فعلی"} · افق: {f.horizonMonths} ماه · اعتماد: {confidenceLabel(f.confidence)} · {formatJalaliDateTime(f.createdAt)}
                          </div>
                          <div className="mt-2">
                            <Link to={`/forecasts/${f.id}`} className="text-primary hover:underline text-[12px]">
                              مشاهده نتایج
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="پیش‌بینی‌ای برای این چاه وجود ندارد" />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === "notes" ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>یادداشت‌ها</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  {canNote ? (
                    <div className="rounded-2xl border border-border bg-card/60 p-3">
                      <Label>یادداشت جدید</Label>
                      <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={4} placeholder="متن..." />
                      <div className="mt-2 flex items-center gap-2 justify-start flex-wrap">
                        <Button
                          variant="primary"
                          disabled={!noteBody.trim()}
                          onClick={async () => {
                            if (!noteBody.trim() || !id) return;
                            await auth.api(`/wells/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ body: noteBody.trim() }) });
                            setNoteBody("");
                            toast.success("ثبت شد");
                            await qNotes.refetch();
                          }}
                        >
                          <Sparkles size={16} />
                          ثبت
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-muted">برای افزودن یادداشت نیاز به نقش «تحلیلگر» دارید.</div>
                  )}

                  <div className="mt-4">
                    {qNotes.isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : qNotes.data?.items?.length ? (
                      <div className="space-y-2">
                        {qNotes.data.items.map((n) => (
                          <div key={n.id} className="rounded-xl border border-border bg-card/60 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[12px] font-semibold">{n.authorUserId}</div>
                              <div className="text-[11px] text-muted">{formatJalaliDateTime(n.createdAt)}</div>
                            </div>
                            <div className="mt-2 text-[13px] whitespace-pre-wrap">{n.body}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="یادداشتی وجود ندارد" />
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>فایل‌ها (دمو)</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="text-[12px] text-muted">
                    در این دمو، فایل‌ها فقط در مرورگر شما نگهداری می‌شوند.
                  </div>
                  <div className="mt-3">
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setAttachments((prev) => [{ name: f.name, size: f.size, addedAt: new Date().toISOString() }, ...prev]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    {attachments.length ? (
                      attachments.map((a, idx) => (
                        <div key={idx} className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate">{a.name}</div>
                            <div className="text-[11px] text-muted">{Math.round(a.size / 1024)} کیلوبایت</div>
                          </div>
                          <div className="mt-1 text-[11px] text-muted">{formatJalaliDateTime(a.addedAt)}</div>
                        </div>
                      ))
                    ) : (
                      <EmptyState title="فایلی اضافه نشده" />
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}

function InfoRow({ k, v }: { k: string; v: any }) {
  const shown = typeof v === "number" && Number.isFinite(v) ? formatFaNumber(v) : String(v);
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3">
      <div className="text-[12px] text-muted">{k}</div>
      <div className="mt-1 text-[13px] font-semibold">{shown}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: any }) {
  const shown = typeof value === "number" && Number.isFinite(value) ? formatFaNumber(value) : String(value);
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[16px] font-semibold">{shown}</div>
    </div>
  );
}
