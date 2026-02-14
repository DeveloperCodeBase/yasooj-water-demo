import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useAuth } from "../app/auth";
import { useFilters } from "../app/filters";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { JobProgressPanel } from "../components/JobProgressPanel";
import { RiskBadge } from "../components/badges";
import { modelFamilyLabel, toFaDigits } from "../lib/labels";

type Scenario = { id: string; name: string; ssp: string; horizonFromYear: number; horizonToYear: number; status: string; lastRunAt: string | null };
type Model = { id: string; name: string; family: string; version: string; status: string };
type WellLookup = { id: string; code: string; name: string; riskLevel: string; dataQualityScore: number };

type RunRes = { forecastId: string; job: { id: string } };

const HORIZONS = [6, 12, 24, 36, 60] as const;

export function ForecastRunPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const filters = useFilters();

  const modelStatusLabel = React.useCallback((status: string) => {
    const s = String(status ?? "").toLowerCase();
    if (s === "active") return "فعال";
    if (s === "draft") return "پیش‌نویس";
    if (s === "archived") return "بایگانی";
    return status;
  }, []);

  const scenariosQ = useQuery({ queryKey: ["lookups", "scenarios"], queryFn: () => auth.api<Scenario[]>("/lookups/scenarios") });
  const modelsQ = useQuery({ queryKey: ["lookups", "models", "active"], queryFn: () => auth.api<Model[]>("/lookups/models?status=active") });

  const [wellSearch, setWellSearch] = React.useState("");
  const wellsQ = useQuery({
    queryKey: ["lookups", "wells", filters.applied.plainId, filters.applied.aquiferId, wellSearch],
    queryFn: () => {
      const qp = new URLSearchParams();
      if (filters.applied.plainId) qp.set("plainId", filters.applied.plainId);
      if (filters.applied.aquiferId) qp.set("aquiferId", filters.applied.aquiferId);
      if (wellSearch) qp.set("search", wellSearch);
      qp.set("limit", "120");
      return auth.api<WellLookup[]>(`/lookups/wells?${qp.toString()}`);
    },
  });

  const scenarios = scenariosQ.data ?? [];
  const models = modelsQ.data ?? [];
  const wells = wellsQ.data ?? [];

  const [step, setStep] = React.useState(1);
  const [scenarioId, setScenarioId] = React.useState<string | null>(filters.applied.scenarioId ?? null);
  const [modelId, setModelId] = React.useState<string>(models.find((m) => m.status === "active")?.id ?? models[0]?.id ?? "");
  const [horizonMonths, setHorizonMonths] = React.useState<number>(24);
  const [selectedWellIds, setSelectedWellIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (modelId) return;
    if (models.length) setModelId(models[0].id);
  }, [models, modelId]);

  const [jobId, setJobId] = React.useState<string | null>(null);
  const [forecastId, setForecastId] = React.useState<string | null>(null);

  const canNext =
    (step === 1 && true) ||
    (step === 2 && !!modelId) ||
    (step === 3 && selectedWellIds.length > 0) ||
    (step === 4 && horizonMonths >= 3 && horizonMonths <= 120);

  const estLoad = selectedWellIds.length * horizonMonths;

  return (
    <Page
      title="اجرای پیش‌بینی"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "پیش‌بینی‌ها", to: "/forecasts" },
        { label: "اجرای جدید" },
      ]}
    >
      {jobId ? (
        <JobProgressPanel
          jobId={jobId}
          title="اجرای پیش‌بینی"
          onSuccess={() => {
            if (forecastId) nav(`/forecasts/${forecastId}`);
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{`گام ${toFaDigits(String(step))} از ۵`}</CardTitle>
              <Badge tone="info">ویزارد</Badge>
            </CardHeader>
            <CardBody>
              {step === 1 ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-muted">سناریوی اقلیمی را انتخاب کنید (اختیاری).</div>
                  <Label>سناریو</Label>
                  <Select value={scenarioId ?? ""} onChange={(e) => setScenarioId(e.target.value || null)}>
                    <option value="">اقلیم فعلی</option>
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-muted">مدل فعال به صورت پیش‌فرض انتخاب می‌شود.</div>
                  <Label>مدل</Label>
                  <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({modelFamilyLabel(m.family)} · {modelStatusLabel(m.status)})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-muted">
                    انتخاب چاه‌ها (چندانتخابی). فیلترهای سراسری دشت/آبخوان اعمال می‌شوند.
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 items-end">
                    <div>
                      <Label>جستجو</Label>
                      <Input value={wellSearch} onChange={(e) => setWellSearch(e.target.value)} placeholder="کد یا نام" />
                    </div>
                    <div className="text-[12px] text-muted text-right">
                      انتخاب شده: {toFaDigits(String(selectedWellIds.length))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border overflow-auto max-h-[360px]">
                    {wells.map((w) => (
                      <label key={w.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start flex-wrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                          checked={selectedWellIds.includes(w.id)}
                          onChange={() => {
                            setSelectedWellIds((prev) => (prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]));
                          }}
                        />
                        <span className="truncate">{w.code}</span>
                        <span className="text-muted/70 shrink-0">کیفیت: {toFaDigits(String(w.dataQualityScore))}</span>
                        <span className="shrink-0"><RiskBadge level={w.riskLevel as any} /></span>
                      </label>
                    ))}
                    {!wells.length ? <div className="px-3 py-3 text-[12px] text-muted">داده‌ای یافت نشد</div> : null}
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-muted">افق پیش‌بینی را انتخاب کنید.</div>
                  <Label>افق (ماه)</Label>
                  <Select value={String(horizonMonths)} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
                    {HORIZONS.map((h) => (
                      <option key={h} value={h}>
                        {toFaDigits(String(h))} ماه
                      </option>
                    ))}
                    <option value={120}>۱۲۰ ماه</option>
                  </Select>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  <div className="text-[13px] text-muted">بررسی نهایی و اجرا</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <SummaryRow k="سناریو" v={scenarioId ? (scenarios.find((s) => s.id === scenarioId)?.name ?? scenarioId) : "اقلیم فعلی"} />
                    <SummaryRow k="مدل" v={models.find((m) => m.id === modelId)?.name ?? modelId} />
                    <SummaryRow k="چاه‌ها" v={toFaDigits(String(selectedWellIds.length))} />
                    <SummaryRow k="افق" v={`${toFaDigits(String(horizonMonths))} ماه`} />
                  </div>
                  <div className="rounded-2xl border border-border bg-card/60 px-3 py-3 text-[12px] text-muted">
                    بار تخمینی: {toFaDigits(String(estLoad))} واحد · اعتبارسنجی‌ها (دمو): تایید
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={async () => {
                      if (!modelId || !selectedWellIds.length) return;
                      try {
                        const res = await auth.api<RunRes>("/forecasts/run", {
                          method: "POST",
                          body: JSON.stringify({ scenarioId: scenarioId ?? null, modelId, wellIds: selectedWellIds, horizonMonths }),
                        });
                        setJobId(res.job.id);
                        setForecastId(res.forecastId);
                        toast.success("شروع شد");
                      } catch (e: any) {
                        toast.error("خطا در اجرا");
                      }
                    }}
                  >
                    <Play size={16} />
                    اجرا
                  </Button>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 justify-start flex-wrap">
                <Button
                  variant="primary"
                  disabled={!canNext || step >= 5}
                  onClick={() => setStep((s) => Math.min(5, s + 1))}
                >
                  بعدی <ChevronLeft size={16} />
                </Button>
                <Button
                  disabled={step <= 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  <ChevronRight size={16} /> قبلی
                </Button>
                {step < 5 ? (
                  <button
                    className="text-[12px] text-primary hover:underline"
                    onClick={() => setStep(5)}
                    type="button"
                  >
                    پرش به اجرا
                  </button>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>چک‌لیست</CardTitle>
              <div />
            </CardHeader>
            <CardBody>
              <ChecklistItem ok={true} text="انتخاب سناریو (اختیاری)" />
              <ChecklistItem ok={!!modelId} text="مدل انتخاب شده" />
              <ChecklistItem ok={selectedWellIds.length > 0} text="حداقل یک چاه" />
              <ChecklistItem ok={horizonMonths >= 3 && horizonMonths <= 120} text="افق معتبر" />
              <div className="mt-4 text-[12px] text-muted">
                نکته: داده‌ها و محاسبات در این دمو شبیه‌سازی می‌شوند.
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}

function ChecklistItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] py-2 border-b border-border">
      <div className="truncate">{text}</div>
      {ok ? <CheckCircle2 size={18} className="text-ok" /> : <span className="text-muted">…</span>}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3">
      <div className="text-[12px] text-muted">{k}</div>
      <div className="mt-1 text-[13px] font-semibold truncate">{String(v)}</div>
    </div>
  );
}
