import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { FileText, Wand2 } from "lucide-react";
import { useAuth } from "../app/auth";
import { useFilters } from "../app/filters";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { JobProgressPanel } from "../components/JobProgressPanel";
import { cn } from "../lib/cn";
import { formatJalaliDate } from "../lib/dates";
import { reportTypeLabel } from "../lib/labels";

type ReportType = "executive" | "technical" | "ops";

const SECTIONS = [
  { id: "kpis", fa: "شاخص‌ها" },
  { id: "scenario_summary", fa: "خلاصه سناریو" },
  { id: "forecast_charts", fa: "نمودارهای پیش‌بینی" },
  { id: "risk_table", fa: "جدول ریسک" },
  { id: "data_quality", fa: "کیفیت داده" },
  { id: "alerts_summary", fa: "خلاصه هشدارها" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function ReportWizardPage() {
  const auth = useAuth();
  const filters = useFilters();
  const nav = useNavigate();

  const [type, setType] = React.useState<ReportType>("executive");
  const [title, setTitle] = React.useState("");
  const [sections, setSections] = React.useState<SectionId[]>(["kpis", "risk_table", "alerts_summary"]);

  const [jobId, setJobId] = React.useState<string | null>(null);
  const [reportId, setReportId] = React.useState<string | null>(null);

  const toggle = (id: SectionId) => setSections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const plainsQ = useQuery({ queryKey: ["lookups", "plains"], queryFn: () => auth.api<Array<{ id: string; nameFa: string }>>("/lookups/plains") });
  const aquifersQ = useQuery({ queryKey: ["lookups", "aquifers"], queryFn: () => auth.api<Array<{ id: string; plainId: string; nameFa: string }>>("/lookups/aquifers") });
  const scenariosQ = useQuery({ queryKey: ["lookups", "scenarios"], queryFn: () => auth.api<Array<{ id: string; name: string }>>("/lookups/scenarios") });

  const plainName = (plainsQ.data ?? []).find((p) => p.id === filters.applied.plainId)?.nameFa ?? null;
  const aquiferName = (aquifersQ.data ?? []).find((a) => a.id === filters.applied.aquiferId)?.nameFa ?? null;
  const scenarioName = (scenariosQ.data ?? []).find((s) => s.id === filters.applied.scenarioId)?.name ?? null;

  const sectionFa = React.useMemo(() => new Map(SECTIONS.map((s) => [s.id, s.fa] as const)), []);
  const sectionsPreview = sections.map((id) => sectionFa.get(id) ?? id).join("، ");

  return (
    <Page
      title="ساخت گزارش"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "گزارش‌ها", to: "/reports" },
        { label: "ساخت" },
      ]}
    >
      {jobId ? (
        <JobProgressPanel
          jobId={jobId}
          title="تولید گزارش"
          onSuccess={() => {
            toast.success("گزارش آماده شد");
            nav("/reports");
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ویزارد گزارش</CardTitle>
              <Badge tone="info">دمو</Badge>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>نوع گزارش</Label>
                  <Select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
                    <option value="executive">مدیریتی</option>
                    <option value="technical">فنی</option>
                    <option value="ops">عملیاتی</option>
                  </Select>
                </div>
                <div>
                  <Label>عنوان (اختیاری)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: گزارش ماهانه" />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[12px] font-semibold">دامنه (فیلترهای سراسری)</div>
                <div className="mt-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-[12px] text-muted">
                  <div>دشت: {plainName ?? (filters.applied.plainId ? filters.applied.plainId : "همه")}</div>
                  <div>آبخوان: {aquiferName ?? (filters.applied.aquiferId ? filters.applied.aquiferId : "همه")}</div>
                  <div>بازه زمانی: {formatJalaliDate(filters.applied.from)} تا {formatJalaliDate(filters.applied.to)}</div>
                  <div>سناریو: {scenarioName ?? (filters.applied.scenarioId ? filters.applied.scenarioId : "اقلیم فعلی")}</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[12px] font-semibold">بخش‌های گزارش</div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {SECTIONS.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2 text-[13px] justify-start text-right">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                        checked={sections.includes(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                      <span>{s.fa}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={cn("mt-6 flex items-center gap-2 justify-start flex-wrap")}>
                <Button
                  variant="primary"
                  disabled={!sections.length}
                  onClick={async () => {
                    if (!sections.length) return;
                    try {
                      const res = await auth.api<{ reportId: string; job: { id: string } }>("/reports/generate", {
                        method: "POST",
                        body: JSON.stringify({
                          type,
                          title: title.trim() || undefined,
                          sections,
                          scope: { ...filters.applied },
                        }),
                      });
                      setJobId(res.job.id);
                      setReportId(res.reportId);
                      toast.success("شروع شد");
                    } catch {
                      toast.error("خطا در تولید گزارش");
                    }
                  }}
                >
                  <Wand2 size={16} />
                  تولید گزارش
                </Button>
                <Button onClick={() => nav("/reports")}>
                  بازگشت
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>پیش‌نمایش</CardTitle>
              <div />
            </CardHeader>
            <CardBody>
              <div className="text-[12px] text-muted">
                گزارش به صورت HTML (قابل دانلود) تولید می‌شود.
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-card/60 px-3 py-3 text-[12px] text-muted">
                <div className="flex items-center gap-2 justify-start">
                  <FileText size={16} />
                  <span>نوع: {reportTypeLabel(type)}</span>
                </div>
                <div className="mt-2">
                  بخش‌ها: {sectionsPreview}
                </div>
                {reportId ? <div className="mt-2">شناسه: {reportId}</div> : null}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
