import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";
import { CheckCircle2, Rocket, Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select, Textarea } from "../components/ui";
import { StatusBadge } from "../components/badges";
import { ValidationReportPanel, type DatasetValidation } from "../components/ValidationReportPanel";
import { EmptyState, Skeleton } from "../components/states";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { datasetFileStatusLabel, datasetSourceLabel, datasetTypeLabel, toFaDigits } from "../lib/labels";

type DatasetFile = { id: string; filename: string; sizeBytes: number; status: "uploaded" | "validated"; uploadedAt: string };
type Dataset = {
  id: string;
  orgId: string;
  name: string;
  type: "climate" | "groundwater" | "usage" | "gis";
  source: "ManualUpload" | "API" | "Other";
  description?: string;
  version: string;
  status: "draft" | "validated" | "published";
  releaseNotes?: string;
  createdAt: string;
  updatedAt: string;
  files: DatasetFile[];
  validation: DatasetValidation | null;
};

export function DatasetDetailPage() {
  const auth = useAuth();
  const { id } = useParams();

  const [tab, setTab] = React.useState<"overview" | "upload" | "publish">("overview");

  const q = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => auth.api<Dataset>(`/datasets/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });

  const ds = q.data;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  React.useEffect(() => {
    if (!ds) return;
    setName(ds.name);
    setDescription(ds.description ?? "");
  }, [ds]);

  const [busy, setBusy] = React.useState(false);

  const canPublish = auth.hasMinRole("admin");
  const [bump, setBump] = React.useState<"major" | "minor" | "patch">("patch");
  const [releaseNotes, setReleaseNotes] = React.useState("");

  return (
    <Page
      title={
        ds ? (
          <div className={cn("flex items-center gap-3 min-w-0 flex-wrap")}>
            <div className="truncate">{ds.name}</div>
            <StatusBadge status={ds.status} />
            <Badge tone="info">{toFaDigits(ds.version)}</Badge>
          </div>
        ) : (
          "جزئیات دیتاست"
        )
      }
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "دیتاست‌ها", to: "/datasets" },
        { label: id ?? "" },
      ]}
      actions={
        tab === "overview" && ds ? (
          <Button
            variant="primary"
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await auth.api(`/datasets/${encodeURIComponent(ds.id)}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
                });
                toast.success("ذخیره شد");
                await q.refetch();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            ذخیره
          </Button>
        ) : null
      }
    >
      {!ds ? (
        <Card>
          <CardBody>{q.isLoading ? <Skeleton className="h-10 w-full" /> : <EmptyState title="دیتاست یافت نشد" />}</CardBody>
        </Card>
      ) : (
        <>
          <div className={cn("flex items-center gap-2 flex-wrap")}>
            <button className={tab === "overview" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("overview")}>
              نمای کلی
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "upload" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("upload")}>
              آپلود و اعتبارسنجی
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "publish" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("publish")}>
              انتشار
            </button>
          </div>

          {tab === "overview" ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>مشخصات</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoRow k="شناسه" v={ds.id} mono />
                    <InfoRow k="نوع" v={datasetTypeLabel(ds.type)} />
                    <InfoRow k="منبع" v={datasetSourceLabel(ds.source)} />
                    <InfoRow k="آخرین بروزرسانی" v={formatJalaliDateTime(ds.updatedAt)} />
                  </div>
                  <div className="mt-4">
                    <Label>نام</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="mt-4">
                    <Label>توضیحات</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>فایل‌ها</CardTitle>
                  <Badge tone="info">{ds.files.length}</Badge>
                </CardHeader>
                <CardBody>
                  {ds.files.length ? (
                    <div className="space-y-2">
                      {ds.files.map((f) => (
                        <div key={f.id} className="rounded-xl border border-border bg-card/60 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-[13px] font-semibold">{f.filename}</div>
                            <Badge tone={f.status === "validated" ? "success" : "warning"}>{datasetFileStatusLabel(f.status)}</Badge>
                          </div>
                          <div className="mt-1 text-[12px] text-muted">
                            {toFaDigits(String(Math.round(f.sizeBytes / 1024)))} کیلوبایت · {formatJalaliDateTime(f.uploadedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="فایلی وجود ندارد" />
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === "upload" ? (
            <div className="mt-5 space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>آپلود</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  <div className="text-[12px] text-muted">کشیدن و رها کردن (دمو) یا انتخاب فایل</div>
                  <div className="mt-3">
                    <input
                      type="file"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        const fd = new FormData();
                        for (const f of files) fd.append("file", f, f.name);
                        try {
                          await auth.api(`/datasets/${encodeURIComponent(ds.id)}/upload`, { method: "POST", body: fd });
                          toast.success("آپلود شد");
                          await q.refetch();
                          e.currentTarget.value = "";
                        } catch {
                          toast.error("خطا در آپلود");
                        }
                      }}
                    />
                  </div>
                  <div className={cn("mt-4 flex items-center gap-2 justify-start flex-wrap")}>
                    <Button
                      variant="primary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const v = await auth.api<DatasetValidation>(`/datasets/${encodeURIComponent(ds.id)}/validate`, { method: "POST" });
                          toast.success("اعتبارسنجی انجام شد");
                          await q.refetch();
                        } catch {
                          toast.error("اعتبارسنجی ناموفق بود");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <CheckCircle2 size={16} />
                      اعتبارسنجی
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {ds.validation ? <ValidationReportPanel validation={ds.validation} /> : <EmptyState title="هنوز اعتبارسنجی نشده" />}
            </div>
          ) : null}

          {tab === "publish" ? (
            <div className="mt-5">
              <Card>
                <CardHeader>
                  <CardTitle>انتشار</CardTitle>
                  <div />
                </CardHeader>
                <CardBody>
                  {!canPublish ? (
                    <div className="text-[12px] text-muted">برای انتشار نیاز به نقش «مدیر» دارید.</div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2 mt-3">
                    <div>
                      <Label>افزایش نسخه</Label>
                      <Select value={bump} onChange={(e) => setBump(e.target.value as any)} disabled={!canPublish}>
                        <option value="major">اصلی</option>
                        <option value="minor">جزئی</option>
                        <option value="patch">اصلاحی</option>
                      </Select>
                    </div>
                    <div>
                      <Label>نسخه فعلی</Label>
                      <Input value={toFaDigits(ds.version)} disabled />
                    </div>
                    <div className="md:col-span-2">
                      <Label>یادداشت انتشار</Label>
                      <Textarea value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} rows={5} disabled={!canPublish} />
                    </div>
                  </div>
                  <div className={cn("mt-4 flex items-center gap-2 justify-start flex-wrap")}>
                    <Button
                      variant="primary"
                      disabled={!canPublish || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await auth.api(`/datasets/${encodeURIComponent(ds.id)}/publish`, {
                            method: "POST",
                            body: JSON.stringify({ bump, releaseNotes: releaseNotes.trim() || undefined }),
                          });
                          toast.success("منتشر شد");
                          await q.refetch();
                        } catch (e: any) {
                          toast.error("خطا در انتشار");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Rocket size={16} />
                      انتشار
                    </Button>
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

function InfoRow({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-3">
      <div className="text-[12px] text-muted">{k}</div>
      <div className={cn("mt-1 text-[13px] font-semibold truncate", mono ? "font-mono text-[12px]" : "")}>{String(v)}</div>
    </div>
  );
}
