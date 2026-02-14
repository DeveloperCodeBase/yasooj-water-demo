import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Select } from "../components/ui";
import { StatusBadge } from "../components/badges";
import { EmptyState, Skeleton } from "../components/states";
import { ChartTooltip } from "../components/ChartTooltip";
import { downloadText } from "../lib/download";
import { toCsv } from "../lib/csv";
import { cn } from "../lib/cn";
import { sspLabel, toFaDigits } from "../lib/labels";
import { formatFaNumber } from "../lib/format";

type Scenario = {
  id: string;
  name: string;
  ssp: string;
  horizonFromYear: number;
  horizonToYear: number;
  method: string;
  status: string;
  lastRunAt?: string;
  createdAt: string;
  plainIds: string[];
};

type ScenarioListRes = { items: Scenario[] };
type Plain = { id: string; nameFa: string; nameEn: string };

type Results = {
  scenarioId: string;
  plainId: string;
  annual: Array<{ year: number; tmean: number; precip: number }>;
  monthlyDist: Array<{ month: number; tmean: number; precip: number }>;
  extremes: { max1DayPrecip: number; heatDays: number };
};

export function ScenarioResultsPage() {
  const auth = useAuth();
  const { id } = useParams();

  const qScList = useQuery({
    queryKey: ["scenarios", "all"],
    queryFn: () => auth.api<ScenarioListRes>(`/scenarios?page=1&pageSize=100&sort=createdAt:desc`),
    enabled: !!id,
  });
  const scenario = (qScList.data?.items ?? []).find((s) => s.id === id) ?? null;

  const plainsQ = useQuery({ queryKey: ["lookups", "plains"], queryFn: () => auth.api<Plain[]>("/lookups/plains"), enabled: !!id });
  const plains = plainsQ.data ?? [];

  const [plainId, setPlainId] = React.useState<string>("");
  React.useEffect(() => {
    if (!scenario) return;
    setPlainId((prev) => prev || scenario.plainIds?.[0] || "");
  }, [scenario]);

  const qRes = useQuery({
    queryKey: ["scenario", id, "results", plainId],
    queryFn: () => auth.api<Results>(`/scenarios/${encodeURIComponent(id!)}/results?plainId=${encodeURIComponent(plainId)}`),
    enabled: !!id && !!plainId,
  });

  const compareChoices = (qScList.data?.items ?? []).filter((s) => s.id !== id && s.status === "ready");
  const [compareId, setCompareId] = React.useState<string>("");
  const qCompare = useQuery({
    queryKey: ["scenario", compareId, "results", plainId],
    queryFn: () => auth.api<Results>(`/scenarios/${encodeURIComponent(compareId)}/results?plainId=${encodeURIComponent(plainId)}`),
    enabled: !!compareId && !!plainId,
    retry: false,
  });

  const res = qRes.data;
  const compare = qCompare.data;

  const tempDelta = res?.annual?.length ? Number((res.annual[res.annual.length - 1].tmean - res.annual[0].tmean).toFixed(2)) : null;
  const precipDelta = res?.annual?.length ? Number((res.annual[res.annual.length - 1].precip - res.annual[0].precip).toFixed(1)) : null;

  const downloadAnnualCsv = () => {
    if (!res?.annual?.length) return;
    const csv = toCsv(res.annual as any[], [
      { key: "year" as any, label: "سال" },
      { key: "tmean" as any, label: "دمای میانگین (°C)" },
      { key: "precip" as any, label: "بارش (میلی‌متر)" },
    ]);
    downloadText(`scenario_${id}_${plainId}_annual.csv`, csv, "text/csv;charset=utf-8");
  };

  const downloadJson = () => {
    if (!res) return;
    downloadText(`scenario_${id}_${plainId}.json`, JSON.stringify(res, null, 2), "application/json;charset=utf-8");
  };

  const compareAnnualByYear = React.useMemo(() => {
    const m = new Map<number, { tmean: number; precip: number }>();
    for (const a of compare?.annual ?? []) m.set(a.year, { tmean: a.tmean, precip: a.precip });
    return m;
  }, [compare?.annual]);

  const methodLabel = (method: string) => {
    const v = String(method ?? "");
    if (v === "LARS-WG") return "مولد آب‌وهوایی";
    if (v === "BiasCorrection") return "تصحیح سوگیری";
    return v;
  };

  const monthLabel = (m: number) => {
    const map: Record<number, string> = {
      1: "فروردین",
      2: "اردیبهشت",
      3: "خرداد",
      4: "تیر",
      5: "مرداد",
      6: "شهریور",
      7: "مهر",
      8: "آبان",
      9: "آذر",
      10: "دی",
      11: "بهمن",
      12: "اسفند",
    };
    return map[m] ?? `ماه ${toFaDigits(String(m))}`;
  };

  return (
    <Page
      title="نتایج سناریو"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "سناریوهای اقلیمی", to: "/scenarios" },
        { label: id ?? "" },
      ]}
      actions={
        <div className={cn("flex items-center gap-2 flex-wrap")}>
          <Button onClick={downloadAnnualCsv} disabled={!res?.annual?.length}>
            <Download size={16} />
            دانلود سی‌اس‌وی
          </Button>
          <Button onClick={downloadJson} disabled={!res}>
            <Download size={16} />
            دانلود جی‌سون
          </Button>
        </div>
      }
    >
      {!scenario ? (
        <Card>
          <CardBody>{qScList.isLoading ? <Skeleton className="h-10 w-full" /> : <EmptyState title="سناریو یافت نشد" />}</CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{scenario.name}</CardTitle>
                <CardDescription>
                  {sspLabel(scenario.ssp)} · {methodLabel(scenario.method)} · {toFaDigits(String(scenario.horizonFromYear))}-{toFaDigits(String(scenario.horizonToYear))}
                </CardDescription>
              </div>
              <StatusBadge status={scenario.status} />
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 md:grid-cols-3 items-end">
                <div>
                  <div className="text-[12px] text-muted">دشت</div>
                  <Select value={plainId} onChange={(e) => setPlainId(e.target.value)}>
                    {scenario.plainIds.map((pid) => (
                      <option key={pid} value={pid}>
                        {plains.find((p) => p.id === pid)?.nameFa ?? pid}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <div className="text-[12px] text-muted">مقایسه با</div>
                  <Select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                    <option value="">بدون مقایسه</option>
                    {compareChoices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="text-[12px] text-muted">
                  برای مشاهده همپوشانی، یک سناریوی دیگر انتخاب کنید.
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card>
              <CardBody>
                <div className="text-[12px] text-muted">تغییر دما</div>
                <div className="mt-2 text-[18px] font-semibold">
                  {tempDelta === null ? "—" : `${tempDelta > 0 ? "+" : ""}${toFaDigits(String(tempDelta))} °C`}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-[12px] text-muted">تغییر بارش</div>
                <div className="mt-2 text-[18px] font-semibold">
                  {precipDelta === null ? "—" : `${precipDelta > 0 ? "+" : ""}${toFaDigits(String(precipDelta))} میلی‌متر`}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-[12px] text-muted">شاخص‌های حدی</div>
                <div className="mt-2 text-[13px] text-muted">
                  {res ? (
                    <>
                      حداکثر بارش یک‌روزه: <span className="font-semibold text-text">{toFaDigits(String(res.extremes.max1DayPrecip))}</span> ·{" "}
                      روزهای داغ: <span className="font-semibold text-text">{toFaDigits(String(res.extremes.heatDays))}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>میانگین دمای سالانه</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[300px] w-full">
                  {qRes.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : res?.annual?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={res.annual.map((a, idx) => ({
                          year: a.year,
                          t_a: a.tmean,
                          t_b: compareAnnualByYear.get(a.year)?.tmean ?? null,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => toFaDigits(String(v))} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <Tooltip content={<ChartTooltip nameMap={{ t_a: "دما (سناریو)", t_b: "دما (مقایسه)" }} />} />
                        <Line type="monotone" dataKey="t_a" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                        {compareId ? <Line type="monotone" dataKey="t_b" stroke="rgb(var(--primary2))" strokeWidth={2} dot={false} /> : null}
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
                <CardTitle>بارش سالانه</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[300px] w-full">
                  {qRes.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : res?.annual?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={res.annual.map((a, idx) => ({
                          year: a.year,
                          p_a: a.precip,
                          p_b: compareAnnualByYear.get(a.year)?.precip ?? null,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => toFaDigits(String(v))} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <Tooltip content={<ChartTooltip nameMap={{ p_a: "بارش (سناریو)", p_b: "بارش (مقایسه)" }} />} />
                        <Bar dataKey="p_a" fill="rgba(18,92,255,0.35)" />
                        {compareId ? <Line type="monotone" dataKey="p_b" stroke="rgb(var(--primary2))" strokeWidth={2} dot={false} /> : null}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="داده‌ای وجود ندارد" />
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>توزیع ماهانه (دمو)</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[300px] w-full">
                  {qRes.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : res?.monthlyDist?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={res.monthlyDist.map((m) => ({ ...m, month: String(m.month) }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => monthLabel(Number(v))} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              labelFormatter={(v) => monthLabel(Number(v))}
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
        </>
      )}
    </Page>
  );
}
