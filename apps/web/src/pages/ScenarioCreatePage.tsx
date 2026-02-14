import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Play, Wand2 } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { JobProgressPanel } from "../components/JobProgressPanel";
import { sspLabel } from "../lib/labels";

type Plain = { id: string; nameFa: string; nameEn: string; province?: string };
type CreateRes = { scenarioId: string; job: { id: string } | null };

export function ScenarioCreatePage() {
  const auth = useAuth();
  const nav = useNavigate();

  const plainsQ = useQuery({ queryKey: ["lookups", "plains"], queryFn: () => auth.api<Plain[]>("/lookups/plains") });
  const plains = plainsQ.data ?? [];

  const [name, setName] = React.useState("سناریوی جدید (دمو)");
  const [ssp, setSsp] = React.useState("SSP2-4.5");
  const [fromYear, setFromYear] = React.useState(2026);
  const [toYear, setToYear] = React.useState(2050);
  const [method, setMethod] = React.useState("LARS-WG");
  const [plainIds, setPlainIds] = React.useState<string[]>([]);
  const [runNow, setRunNow] = React.useState(true);

  React.useEffect(() => {
    if (plainIds.length) return;
    if (plains.length) setPlainIds(plains.slice(0, 2).map((p) => p.id));
  }, [plains, plainIds.length]);

  const [jobId, setJobId] = React.useState<string | null>(null);
  const [scenarioId, setScenarioId] = React.useState<string | null>(null);

  const togglePlain = (id: string) => setPlainIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Page
      title="ایجاد سناریو"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "سناریوها", to: "/scenarios" },
        { label: "ایجاد" },
      ]}
    >
      {jobId ? (
        <JobProgressPanel
          jobId={jobId}
          title="اجرای سناریو"
          onSuccess={() => {
            if (scenarioId) nav(`/scenarios/${scenarioId}`);
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>فرم سناریو</CardTitle>
              <Badge tone="info">دمو</Badge>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>نام</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>اس‌اس‌پی</Label>
                  <Select value={ssp} onChange={(e) => setSsp(e.target.value)}>
                    {["SSP1-2.6", "SSP2-4.5", "SSP3-7.0", "SSP5-8.5"].map((v) => (
                      <option key={v} value={v}>
                        {sspLabel(v)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>روش</Label>
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="LARS-WG">مولد آب‌وهوایی (دمو)</option>
                    <option value="BiasCorrection">تصحیح سوگیری (دمو)</option>
                  </Select>
                </div>
                <div>
                  <Label>از سال</Label>
                  <Input type="number" value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} />
                </div>
                <div>
                  <Label>تا سال</Label>
                  <Input type="number" value={toYear} onChange={(e) => setToYear(Number(e.target.value))} />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[12px] font-semibold">انتخاب دشت‌ها</div>
                <div className="mt-2 rounded-2xl border border-border overflow-auto max-h-[280px]">
                  {plains.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                        checked={plainIds.includes(p.id)}
                        onChange={() => togglePlain(p.id)}
                      />
                      <span className="truncate">{p.nameFa}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[13px] flex-wrap">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                      checked={runNow}
                      onChange={(e) => setRunNow(e.target.checked)}
                    />
                    <span>اجرای فوری</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 justify-start flex-wrap">
                <Button
                  variant="primary"
                  disabled={name.trim().length < 2 || plainIds.length < 1 || toYear < fromYear}
                  onClick={async () => {
                    try {
                      const res = await auth.api<CreateRes>("/scenarios", {
                        method: "POST",
                        body: JSON.stringify({
                          name: name.trim(),
                          ssp,
                          horizonFromYear: fromYear,
                          horizonToYear: toYear,
                          method,
                          plainIds,
                          runNow,
                        }),
                      });
                      setScenarioId(res.scenarioId);
                      if (res.job?.id) {
                        setJobId(res.job.id);
                        toast.success("در حال اجرا");
                      } else {
                        toast.success("ایجاد شد");
                        nav(`/scenarios/${res.scenarioId}`);
                      }
                    } catch {
                      toast.error("خطا");
                    }
                  }}
                >
                  <Play size={16} />
                  اجرا
                </Button>
                <Button onClick={() => nav("/scenarios")}>
                  انصراف
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>راهنما</CardTitle>
              <div />
            </CardHeader>
            <CardBody>
              <div className="text-[12px] text-muted">
                در این دمو، اجرای سناریو به صورت «کار» شبیه‌سازی می‌شود و سپس نتایج تولید می‌گردد.
              </div>
                <div className="mt-4 rounded-2xl border border-border bg-card/60 px-3 py-3 text-[12px] text-muted">
                <div className="flex items-center gap-2 justify-start flex-wrap">
                  <Wand2 size={16} />
                  <span>نکته: پس از اجرا، صفحه نتایج را ببینید.</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
