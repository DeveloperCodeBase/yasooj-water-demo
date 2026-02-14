import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { SortingState } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { CheckCircle2, Database, FileText, Plus, Rocket } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select, Textarea } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/badges";
import { Modal } from "../components/Modal";
import { KpiCard } from "../components/KpiCard";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { datasetSourceLabel, datasetTypeLabel, toFaDigits } from "../lib/labels";

type Dataset = { id: string; name: string; type: "climate" | "groundwater" | "usage" | "gis"; version: string; status: "draft" | "validated" | "published"; createdAt: string; updatedAt: string };
type Res = { items: Dataset[]; page: number; pageSize: number; total: number; sort: string };

export function DatasetsListPage() {
  const auth = useAuth();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "createdAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["datasets", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/datasets?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const items = q.data?.items ?? [];
  const kpiDrafts = items.filter((d) => d.status === "draft").length;
  const kpiValidated = items.filter((d) => d.status === "validated").length;
  const kpiPublished = items.filter((d) => d.status === "published").length;

  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<Dataset["type"]>("groundwater");
  const [source, setSource] = React.useState<"ManualUpload" | "API" | "Other">("ManualUpload");
  const [desc, setDesc] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <Page
      title="دیتاست‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "دیتاست‌ها" },
      ]}
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          ایجاد دیتاست
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="کل دیتاست‌ها" value={items.length} icon={<Database size={18} />} />
        <KpiCard title="پیش‌نویس" value={kpiDrafts} icon={<FileText size={18} />} />
        <KpiCard title="اعتبارسنجی‌شده" value={kpiValidated} icon={<CheckCircle2 size={18} />} />
        <KpiCard title="منتشرشده" value={kpiPublished} icon={<Rocket size={18} />} />
      </div>

      <div className="mt-5">
        <DataTable
          title="لیست دیتاست‌ها"
          loading={q.isLoading}
          data={items}
          page={q.data?.page ?? page}
          pageSize={q.data?.pageSize ?? pageSize}
          total={q.data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
          columns={[
            { id: "name", header: "نام", accessorKey: "name", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
            { id: "type", header: "نوع", accessorKey: "type", cell: (ctx) => <Badge tone="info">{datasetTypeLabel(String(ctx.getValue()))}</Badge> },
            { id: "version", header: "نسخه", accessorKey: "version", cell: (ctx) => toFaDigits(String(ctx.getValue() ?? "")) },
            { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
            { id: "createdAt", header: "ایجاد", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
            {
              id: "actions",
              header: "",
              accessorKey: "id",
              cell: (ctx) => (
                <Link to={`/datasets/${String(ctx.getValue())}`} className="text-primary hover:underline text-[12px]">
                  مدیریت
                </Link>
              ),
            },
          ]}
          emptyTitle="دیتاستی وجود ندارد"
        />
      </div>

      <Modal
        open={createOpen}
        title="ایجاد دیتاست"
        onClose={() => {
          if (!busy) setCreateOpen(false);
        }}
        footer={
          <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
            <Button
              variant="primary"
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await auth.api<{ id: string }>("/datasets", {
                    method: "POST",
                    body: JSON.stringify({ name: name.trim(), type, source, description: desc.trim() || undefined }),
                  });
                  toast.success("ایجاد شد");
                  setCreateOpen(false);
                  setName("");
                  setDesc("");
                  await q.refetch();
                } catch {
                  toast.error("خطا در ایجاد دیتاست");
                } finally {
                  setBusy(false);
                }
              }}
            >
              ذخیره پیش‌نویس
            </Button>
            <Button disabled={busy} onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>نام دیتاست</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: آب زیرزمینی دشت یاسوج" />
          </div>
          <div>
            <Label>نوع</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="groundwater">{datasetTypeLabel("groundwater")}</option>
              <option value="climate">{datasetTypeLabel("climate")}</option>
              <option value="usage">{datasetTypeLabel("usage")}</option>
              <option value="gis">{datasetTypeLabel("gis")}</option>
            </Select>
          </div>
          <div>
            <Label>منبع</Label>
            <Select value={source} onChange={(e) => setSource(e.target.value as any)}>
              <option value="ManualUpload">{datasetSourceLabel("ManualUpload")}</option>
              <option value="API">{datasetSourceLabel("API")}</option>
              <option value="Other">{datasetSourceLabel("Other")}</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>توضیحات</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
          </div>
        </div>
      </Modal>
    </Page>
  );
}
