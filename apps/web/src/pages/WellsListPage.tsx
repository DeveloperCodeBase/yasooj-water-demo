import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Download, Tags, CheckCircle2, XCircle, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../app/auth";
import { useFilters } from "../app/filters";
import { Page } from "../components/Page";
import { Button, Card, CardBody, Input, Label, Select } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { RiskBadge, StatusBadge } from "../components/badges";
import { downloadText } from "../lib/download";
import { toCsv } from "../lib/csv";
import { formatJalaliDateTime } from "../lib/dates";
import { formatFaNumber } from "../lib/format";

type WellRow = {
  id: string;
  wellCode: string;
  name: string;
  plainId: string;
  plainName: string;
  aquiferId: string;
  aquiferName: string;
  latestGwLevel: number | null;
  change30d: number | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  dataQualityScore: number;
  tags: string[];
  status: "active" | "inactive";
  lastUpdate: string;
};

type WellsRes = {
  items: WellRow[];
  page: number;
  pageSize: number;
  total: number;
  sort: string;
};

type Plain = { id: string; nameFa: string; nameEn: string };
type Aquifer = { id: string; plainId: string; nameFa: string; nameEn: string };

export function WellsListPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const filters = useFilters();

  const [search, setSearch] = React.useState("");
  const [riskLevel, setRiskLevel] = React.useState<string>("");
  const [minQuality, setMinQuality] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "lastUpdate", desc: true }]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "lastUpdate:desc";
    const dir = s.desc ? "desc" : "asc";
    // Map client ids to API sort fields.
    const field = s.id === "wellCode" ? "createdAt" : s.id;
    return `${field}:${dir}`;
  }, [sorting]);

  const f = filters.applied;
  const q = useQuery({
    queryKey: ["wells", { f, search, riskLevel, minQuality, status, page, pageSize, sortParam }],
    queryFn: () => {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (f.plainId) qp.set("plainId", f.plainId);
      if (f.aquiferId) qp.set("aquiferId", f.aquiferId);
      if (riskLevel) qp.set("riskLevel", riskLevel);
      if (minQuality) qp.set("minQuality", minQuality);
      if (status) qp.set("status", status);
      qp.set("page", String(page));
      qp.set("pageSize", String(pageSize));
      qp.set("sort", sortParam);
      return auth.api<WellsRes>(`/wells?${qp.toString()}`);
    },
  });

  const plainsQ = useQuery({ queryKey: ["lookups", "plains"], queryFn: () => auth.api<Plain[]>("/lookups/plains") });
  const aquifersQ = useQuery({
    queryKey: ["lookups", "aquifers", "all"],
    queryFn: () => auth.api<Aquifer[]>("/lookups/aquifers"),
  });

  const selectedIds = Object.entries(rowSelection)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const selectedRows = (q.data?.items ?? []).filter((w) => selectedIds.includes(w.id));

  const exportCsv = (items: WellRow[]) => {
    const csv = toCsv(items, [
      { key: "wellCode", label: "کد چاه" },
      { key: "plainName", label: "دشت" },
      { key: "aquiferName", label: "آبخوان" },
      { key: "latestGwLevel", label: "آخرین سطح" },
      { key: "change30d", label: "تغییر ۳۰ روز" },
      { key: "riskLevel", label: "سطح ریسک" },
      { key: "dataQualityScore", label: "امتیاز کیفیت داده" },
      { key: "status", label: "وضعیت" },
      { key: "lastUpdate", label: "آخرین بروزرسانی" },
      { key: "tags", label: "برچسب‌ها" },
    ]);
    downloadText(`wells_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  };

  const [addOpen, setAddOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<WellRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [tagOpen, setTagOpen] = React.useState(false);
  const [tagValue, setTagValue] = React.useState("");

  const canCreate = auth.hasMinRole("analyst");
  const canDelete = auth.hasMinRole("admin");

  const doPatchMany = async (ids: string[], patch: any) => {
    await Promise.all(ids.map((id) => auth.api(`/wells/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) })));
    setRowSelection({});
    await q.refetch();
  };

  const AddWellModal = (
    <WellEditorModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      onSaved={async () => {
        setAddOpen(false);
        await q.refetch();
      }}
      mode="create"
      plains={plainsQ.data ?? []}
      aquifers={aquifersQ.data ?? []}
    />
  );

  const EditWellModal = (
    <WellEditorModal
      open={!!edit}
      onClose={() => setEdit(null)}
      onSaved={async () => {
        setEdit(null);
        await q.refetch();
      }}
      mode="edit"
      well={edit ?? undefined}
      plains={plainsQ.data ?? []}
      aquifers={aquifersQ.data ?? []}
    />
  );

  return (
    <Page
      title="پایش چاه‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "پایش چاه‌ها" },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => exportCsv(q.data?.items ?? [])} disabled={!q.data?.items?.length}>
            <Download size={16} />
            خروجی سی‌اس‌وی
          </Button>
          {canCreate ? (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={16} />
              افزودن چاه
            </Button>
          ) : null}
        </div>
      }
    >
      <Card>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-12 items-end">
            <div className="md:col-span-4">
              <Label>جستجو</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="کد/نام چاه" />
            </div>
            <div className="md:col-span-2">
              <Label>ریسک</Label>
              <Select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                <option value="">همه</option>
                <option value="low">کم</option>
                <option value="medium">متوسط</option>
                <option value="high">زیاد</option>
                <option value="critical">بحرانی</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>حداقل کیفیت</Label>
              <Input type="number" value={minQuality} onChange={(e) => setMinQuality(e.target.value)} placeholder="۰ تا ۱۰۰" />
            </div>
            <div className="md:col-span-2">
              <Label>وضعیت</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">همه</option>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </Select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  setSearch("");
                  setRiskLevel("");
                  setMinQuality("");
                  setStatus("");
                  setPage(1);
                }}
              >
                پاک کردن
              </Button>
            </div>
          </div>

          {selectedIds.length ? (
            <div className="mt-4 rounded-2xl border border-border bg-card/60 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[12px] text-muted">
                انتخاب شده: {formatFaNumber(selectedIds.length, 0)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" onClick={() => exportCsv(selectedRows)} disabled={!selectedRows.length}>
                  <Download size={16} />
                  خروجی منتخب
                </Button>
                <Button size="sm" onClick={() => setTagOpen(true)}>
                  <Tags size={16} />
                  برچسب
                </Button>
                <Button size="sm" onClick={() => void doPatchMany(selectedIds, { status: "active" })}>
                  <CheckCircle2 size={16} />
                  فعال
                </Button>
                <Button size="sm" onClick={() => void doPatchMany(selectedIds, { status: "inactive" })}>
                  <XCircle size={16} />
                  غیرفعال
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="mt-5">
        <DataTable
          title="لیست چاه‌ها"
          loading={q.isLoading}
          data={q.data?.items ?? []}
          page={q.data?.page ?? page}
          pageSize={q.data?.pageSize ?? pageSize}
          total={q.data?.total ?? 0}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row) => (row as any).id}
          columns={[
            {
              id: "select",
              header: ({ table }) => (
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                  checked={table.getIsAllPageRowsSelected()}
                  onChange={table.getToggleAllPageRowsSelectedHandler()}
                  aria-label="انتخاب همه"
                />
              ),
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  aria-label="انتخاب"
                />
              ),
            },
            {
              id: "wellCode",
              header: "کد",
              accessorKey: "wellCode",
              cell: (ctx) => (
                <button className="font-semibold hover:underline" onClick={() => nav(`/wells/${String((ctx.row.original as any).id)}`)}>
                  {String(ctx.getValue())}
                </button>
              ),
            },
            { id: "plainName", header: "دشت", accessorKey: "plainName" },
            { id: "aquiferName", header: "آبخوان", accessorKey: "aquiferName" },
            { id: "latestGwLevel", header: "آخرین سطح", accessorKey: "latestGwLevel" },
            { id: "change30d", header: "تغییر ۳۰ روز", accessorKey: "change30d" },
            { id: "riskLevel", header: "ریسک", accessorKey: "riskLevel", cell: (ctx) => <RiskBadge level={ctx.getValue() as any} /> },
            { id: "dataQualityScore", header: "کیفیت", accessorKey: "dataQualityScore" },
            {
              id: "tags",
              header: "برچسب‌ها",
              accessorKey: "tags",
              cell: (ctx) => (Array.isArray(ctx.getValue()) ? (ctx.getValue() as any[]).join(", ") : ""),
            },
            { id: "lastUpdate", header: "آخرین بروزرسانی", accessorKey: "lastUpdate", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
            { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
            {
              id: "actions",
              header: "اقدامات",
              accessorKey: "id",
              cell: (ctx) => {
                const id = String(ctx.getValue());
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link className="text-primary hover:underline text-[12px]" to={`/wells/${id}`}>
                      مشاهده
                    </Link>
                    {canCreate ? (
                      <button className="text-[12px] text-muted hover:text-text" onClick={() => setEdit(ctx.row.original as any)} title="ویرایش">
                        <Pencil size={16} />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button className="text-[12px] text-danger hover:opacity-80" onClick={() => setDeleteId(id)} title="حذف">
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
          emptyTitle="چاهی یافت نشد"
          emptyDescription="فیلترها را تغییر دهید."
        />
      </div>

      {AddWellModal}
      {EditWellModal}

      <ConfirmDialog
        open={!!deleteId}
        title="حذف چاه"
        description="این عملیات قابل بازگشت نیست."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await auth.api(`/wells/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
          toast.success("حذف شد");
          setDeleteId(null);
          await q.refetch();
        }}
      />

      <Modal
        open={tagOpen}
        title="افزودن برچسب"
        onClose={() => {
          setTagOpen(false);
          setTagValue("");
        }}
        footer={
          <div className="flex items-center gap-2 justify-start flex-wrap">
            <Button
              variant="primary"
              onClick={async () => {
                const tag = tagValue.trim();
                if (!tag) return;
                const rows = selectedRows;
                await Promise.all(
                  rows.map((w) => {
                    const tags = Array.from(new Set([...(w.tags ?? []), tag]));
                    return auth.api(`/wells/${encodeURIComponent(w.id)}`, { method: "PATCH", body: JSON.stringify({ tags }) });
                  })
                );
                toast.success("برچسب اضافه شد");
                setTagOpen(false);
                setTagValue("");
                setRowSelection({});
                await q.refetch();
              }}
            >
              ثبت
            </Button>
            <Button
              onClick={() => {
                setTagOpen(false);
                setTagValue("");
              }}
            >
              انصراف
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="text-[12px] text-muted">
            این برچسب به چاه‌های انتخاب‌شده اضافه می‌شود.
          </div>
          <div>
            <Label>برچسب</Label>
            <Input value={tagValue} onChange={(e) => setTagValue(e.target.value)} placeholder="مثال: اولویت" />
          </div>
        </div>
      </Modal>
    </Page>
  );
}

function WellEditorModal({
  open,
  onClose,
  onSaved,
  mode,
  well,
  plains,
  aquifers,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  mode: "create" | "edit";
  well?: WellRow;
  plains: Plain[];
  aquifers: Aquifer[];
}) {
  const auth = useAuth();
  const [busy, setBusy] = React.useState(false);

  const [code, setCode] = React.useState(well?.wellCode ?? "");
  const [name, setName] = React.useState(well?.name ?? "");
  const [plainId, setPlainId] = React.useState(well?.plainId ?? (plains[0]?.id ?? ""));
  const [aquiferId, setAquiferId] = React.useState(well?.aquiferId ?? "");
  const [status, setStatus] = React.useState<"active" | "inactive">((well?.status ?? "active") as any);
  const [depthM, setDepthM] = React.useState("180");
  const [lat, setLat] = React.useState("30.66");
  const [lon, setLon] = React.useState("51.59");
  const [tags, setTags] = React.useState((well?.tags ?? []).join(", "));

  React.useEffect(() => {
    if (!open) return;
    setCode(well?.wellCode ?? "");
    setName(well?.name ?? "");
    setPlainId(well?.plainId ?? (plains[0]?.id ?? ""));
    setAquiferId(well?.aquiferId ?? "");
    setStatus((well?.status ?? "active") as any);
    setTags((well?.tags ?? []).join(", "));
  }, [open, well, plains]);

  const aquifersForPlain = aquifers.filter((a) => a.plainId === plainId);
  React.useEffect(() => {
    if (!plainId) return;
    if (aquifersForPlain.some((a) => a.id === aquiferId)) return;
    setAquiferId(aquifersForPlain[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plainId]);

  return (
    <Modal
      open={open}
      title={mode === "create" ? "افزودن چاه" : "ویرایش چاه"}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="flex items-center gap-2 justify-start flex-wrap">
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (mode === "create") {
                  await auth.api("/wells", {
                    method: "POST",
                    body: JSON.stringify({
                      code,
                      name,
                      plainId,
                      aquiferId,
                      status,
                      depthM: Number(depthM),
                      lat: Number(lat),
                      lon: Number(lon),
                    }),
                  });
                  toast.success("ایجاد شد");
                } else if (well) {
                  await auth.api(`/wells/${encodeURIComponent(well.id)}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      name,
                      status,
                      tags: tags
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }),
                  });
                  toast.success("ذخیره شد");
                }
                await onSaved();
              } finally {
                setBusy(false);
              }
            }}
          >
            ذخیره
          </Button>
          <Button disabled={busy} onClick={onClose}>
            انصراف
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {mode === "create" ? (
          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <div>
              <Label>کد چاه</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="YAS-031" />
            </div>
            <div>
              <Label>نام</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="چاه ..." />
            </div>
          </div>
        ) : (
          <div className="md:col-span-2">
            <Label>نام</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div>
          <Label>دشت</Label>
          <Select value={plainId} onChange={(e) => setPlainId(e.target.value)}>
            {plains.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFa}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>آبخوان</Label>
          <Select value={aquiferId} onChange={(e) => setAquiferId(e.target.value)}>
            {aquifersForPlain.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameFa}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>وضعیت</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </Select>
        </div>
        <div>
          <Label>برچسب‌ها</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="مثال: اولویت، پایش" />
        </div>

        {mode === "create" ? (
          <>
            <div>
              <Label>عمق (متر)</Label>
              <Input type="number" value={depthM} onChange={(e) => setDepthM(e.target.value)} />
            </div>
            <div>
              <Label>عرض/طول جغرافیایی</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={lat} onChange={(e) => setLat(e.target.value)} />
                <Input value={lon} onChange={(e) => setLon(e.target.value)} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
