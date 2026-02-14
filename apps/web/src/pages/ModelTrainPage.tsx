import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Label, Select } from "../components/ui";
import { JobProgressPanel } from "../components/JobProgressPanel";
import { cn } from "../lib/cn";
import { StatusBadge } from "../components/badges";
import { datasetTypeLabel, modelFamilyLabel } from "../lib/labels";

type Dataset = { id: string; name: string; type: string; status: string; version: string };
type DsRes = { items: Dataset[] };

type TrainRes = { job: { id: string }; modelId: string };

export function ModelTrainPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const dsQ = useQuery({
    queryKey: ["datasets", "for-train"],
    queryFn: () => auth.api<DsRes>(`/datasets?page=1&pageSize=100&sort=updatedAt:desc`),
  });

  const datasets = dsQ.data?.items ?? [];
  const [datasetIds, setDatasetIds] = React.useState<string[]>([]);
  const [family, setFamily] = React.useState<"RF" | "XGB" | "LSTM">("XGB");
  const [includePrecipTemp, setIncludePrecipTemp] = React.useState(true);
  const [includeLagFeatures, setIncludeLagFeatures] = React.useState(true);

  React.useEffect(() => {
    if (datasetIds.length) return;
    const gw = datasets.find((d) => d.type === "groundwater")?.id;
    const cl = datasets.find((d) => d.type === "climate")?.id;
    const next = [gw, cl].filter(Boolean) as string[];
    if (next.length) setDatasetIds(next);
  }, [datasets, datasetIds.length]);

  const toggle = (id: string) => setDatasetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const [jobId, setJobId] = React.useState<string | null>(null);
  const [modelId, setModelId] = React.useState<string | null>(null);

  return (
    <Page
      title="آموزش مدل"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "مدل‌ها", to: "/models" },
        { label: "آموزش" },
      ]}
    >
      {jobId ? (
        <JobProgressPanel
          jobId={jobId}
          title="کار آموزش مدل"
          onSuccess={() => {
            if (modelId) nav(`/models/${modelId}`);
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>فرم آموزش</CardTitle>
              <Badge tone="info">دمو</Badge>
            </CardHeader>
            <CardBody>
              <div className="space-y-5">
                <div>
                  <div className="text-[12px] font-semibold">انتخاب دیتاست‌ها</div>
                  <div className="mt-2 rounded-2xl border border-border overflow-auto max-h-[280px]">
                    {datasets.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start flex-wrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                          checked={datasetIds.includes(d.id)}
                          onChange={() => toggle(d.id)}
                        />
                        <span className="truncate">
                          {d.name}{" "}
                          <span className="text-muted/70">
                            ({datasetTypeLabel(d.type)} · <StatusBadge status={d.status} />)
                          </span>
                        </span>
                      </label>
                    ))}
                    {!datasets.length ? <div className="px-3 py-3 text-[12px] text-muted">داده‌ای وجود ندارد</div> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>خانواده</Label>
                    <Select value={family} onChange={(e) => setFamily(e.target.value as any)}>
                      <option value="RF">{modelFamilyLabel("RF")}</option>
                      <option value="XGB">{modelFamilyLabel("XGB")}</option>
                      <option value="LSTM">{modelFamilyLabel("LSTM")}</option>
                    </Select>
                  </div>
                  <div className="text-[12px] text-muted">
                    هدف: سطح آب زیرزمینی (دمو)
                  </div>
                </div>

                <div className={cn("flex items-center gap-3 text-[13px] justify-start flex-wrap")}>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                      checked={includePrecipTemp}
                      onChange={(e) => setIncludePrecipTemp(e.target.checked)}
                    />
                    <span>ویژگی‌های بارش/دما</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                      checked={includeLagFeatures}
                      onChange={(e) => setIncludeLagFeatures(e.target.checked)}
                    />
                    <span>ویژگی‌های تاخیری</span>
                  </label>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  disabled={datasetIds.length < 1}
                  onClick={async () => {
                    try {
                      const res = await auth.api<TrainRes>("/models/train", {
                        method: "POST",
                        body: JSON.stringify({ datasetIds, family, includePrecipTemp, includeLagFeatures, target: "gwLevel" }),
                      });
                      setJobId(res.job.id);
                      setModelId(res.modelId);
                      toast.success("شروع شد");
                    } catch {
                      toast.error("خطا در شروع آموزش");
                    }
                  }}
                >
                  <Play size={16} />
                  آموزش
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>مراحل</CardTitle>
              <div />
            </CardHeader>
            <CardBody>
              <div className="text-[12px] text-muted">
                <div>1) آماده‌سازی داده</div>
                <div>2) آموزش</div>
                <div>3) اعتبارسنجی</div>
                <div>4) بسته‌بندی خروجی‌ها</div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
