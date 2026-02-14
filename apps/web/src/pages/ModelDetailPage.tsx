import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { RotateCcw, Zap } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Card, CardBody, CardHeader, CardTitle, Select } from "../components/ui";
import { StatusBadge } from "../components/badges";
import { EmptyState, Skeleton } from "../components/states";
import { cn } from "../lib/cn";
import { ChartTooltip } from "../components/ChartTooltip";
import { formatJalaliDateTime } from "../lib/dates";
import { formatFaNumber } from "../lib/format";
import { modelFamilyLabel, toFaDigits } from "../lib/labels";

type Model = {
  id: string;
  name: string;
  family: string;
  version: string;
  status: "draft" | "active" | "archived";
  trainedAt?: string;
  createdAt: string;
  metricsBadge?: string;
};

type MetricsRes = {
  modelId: string;
  metrics: { rmse: number; mae: number; r2: number; nse: number };
  residuals: Array<{ actual: number; pred: number; res: number }>;
  featureImportance: Array<{ feature: string; importance: number }>;
};

type ModelsRes = { items: Model[] };

function hist(values: number[], bins = 16) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const out = Array.from({ length: bins }).map((_, i) => ({ bin: i, from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    out[idx].count += 1;
  }
  return out.map((b) => ({ label: `${formatFaNumber(b.from, 1)}..${formatFaNumber(b.to, 1)}`, count: b.count }));
}

export function ModelDetailPage() {
  const auth = useAuth();
  const { id } = useParams();
  const canDeploy = auth.hasMinRole("admin");

  const qModel = useQuery({
    queryKey: ["model", id],
    queryFn: () => auth.api<Model>(`/models/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
  const model = qModel.data;

  const qMetrics = useQuery({
    queryKey: ["model", id, "metrics"],
    queryFn: () => auth.api<MetricsRes>(`/models/${encodeURIComponent(id!)}/metrics`),
    enabled: !!id,
  });

  const qAll = useQuery({
    queryKey: ["models", "all"],
    queryFn: () => auth.api<ModelsRes>(`/models?page=1&pageSize=200&sort=trainedAt:desc`),
    enabled: !!id && canDeploy,
  });

  const [rollbackTo, setRollbackTo] = React.useState<string>("");

  const residualHist = React.useMemo(() => hist((qMetrics.data?.residuals ?? []).map((r) => r.res), 18), [qMetrics.data]);

  const statusFa = (s: string) => {
    const v = String(s ?? "").toLowerCase();
    if (v === "active") return "فعال";
    if (v === "draft") return "پیش‌نویس";
    if (v === "archived") return "بایگانی";
    return s;
  };

  return (
    <Page
      title={model ? `${model.name}` : "جزئیات مدل"}
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "مدل‌ها", to: "/models" },
        { label: id ?? "" },
      ]}
      actions={
        model && canDeploy ? (
          <div className={cn("flex items-center gap-2 flex-wrap")}>
            <Button
              variant="primary"
              disabled={model.status === "active"}
              onClick={async () => {
                await auth.api(`/models/${encodeURIComponent(model.id)}/activate`, { method: "POST" });
                toast.success("فعال شد");
                await qModel.refetch();
                await qAll.refetch();
              }}
            >
              <Zap size={16} />
              فعال‌سازی
            </Button>
          </div>
        ) : null
      }
    >
      {!model ? (
        <Card>
          <CardBody>{qModel.isLoading ? <Skeleton className="h-10 w-full" /> : <EmptyState title="مدل یافت نشد" />}</CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{model.name}</CardTitle>
                <div className="text-[12px] text-muted">
                  {modelFamilyLabel(model.family)} · {toFaDigits(model.version)} ·{" "}
                  {model.trainedAt ? formatJalaliDateTime(model.trainedAt) : "آموزش نشده"}
                </div>
              </div>
              <StatusBadge status={model.status} />
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label="ریشه‌میانگین مربعات خطا" value={qMetrics.data?.metrics.rmse} />
                <MetricCard label="میانگین قدرمطلق خطا" value={qMetrics.data?.metrics.mae} />
                <MetricCard label="ضریب تعیین" value={qMetrics.data?.metrics.r2} />
                <MetricCard label="کارایی نش-ساتکلیف" value={qMetrics.data?.metrics.nse} />
              </div>
            </CardBody>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>هیستوگرام باقیمانده</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {qMetrics.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : residualHist.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={residualHist}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v, 0)} />
                        <Tooltip content={<ChartTooltip nameMap={{ count: "تعداد" }} />} />
                        <Bar dataKey="count" fill="rgba(18,92,255,0.45)" radius={[8, 8, 0, 0]} />
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
                <CardTitle>پیش‌بینی در برابر واقعیت</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {qMetrics.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (qMetrics.data?.residuals ?? []).length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis type="number" dataKey="actual" name="actual" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <YAxis type="number" dataKey="pred" name="pred" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip nameMap={{ actual: "واقعی", pred: "پیش‌بینی" }} />} />
                        <Scatter data={qMetrics.data!.residuals} fill="rgba(4,205,159,0.6)" />
                      </ScatterChart>
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
                <CardTitle>اهمیت ویژگی‌ها</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                <div className="h-[290px] w-full">
                  {qMetrics.isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (qMetrics.data?.featureImportance ?? []).length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...qMetrics.data!.featureImportance].sort((a, b) => b.importance - a.importance)}
                        layout="vertical"
                        margin={{ right: 90, left: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatFaNumber(v)} />
                        <YAxis type="category" dataKey="feature" orientation="right" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip content={<ChartTooltip nameMap={{ importance: "اهمیت" }} />} />
                        <Bar dataKey="importance" fill="rgba(18,92,255,0.45)" radius={[0, 10, 10, 0]} />
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
                <CardTitle>فعال‌سازی / بازگشت نسخه</CardTitle>
                <div />
              </CardHeader>
              <CardBody>
                {!canDeploy ? (
                  <div className="text-[12px] text-muted">نیاز به نقش «مدیر»</div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3 text-[12px] text-muted">
                      با فعال‌سازی، سایر مدل‌ها بایگانی می‌شوند. بازگشت نسخه (Rollback) مدل فعال را به مدل دیگر تغییر می‌دهد.
                    </div>

                    <div>
                      <div className="text-[12px] text-muted">بازگشت به</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Select value={rollbackTo} onChange={(e) => setRollbackTo(e.target.value)}>
                          <option value="">انتخاب...</option>
                          {(qAll.data?.items ?? [])
                            .filter((m) => m.id !== model.id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({statusFa(m.status)})
                              </option>
                            ))}
                        </Select>
                        <Button
                          disabled={!rollbackTo}
                          onClick={async () => {
                            if (!rollbackTo) return;
                            await auth.api(`/models/${encodeURIComponent(model.id)}/rollback`, { method: "POST", body: JSON.stringify({ toModelId: rollbackTo }) });
                            toast.success("بازگشت نسخه انجام شد");
                            await qModel.refetch();
                            await qAll.refetch();
                          }}
                        >
                          <RotateCcw size={16} />
                          بازگشت نسخه
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}

function MetricCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[16px] font-semibold">{value === undefined ? "—" : formatFaNumber(value)}</div>
    </div>
  );
}
