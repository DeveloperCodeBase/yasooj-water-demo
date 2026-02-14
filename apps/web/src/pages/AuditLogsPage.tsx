import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Card, CardBody, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { JalaliDateInput } from "../components/JalaliDateInput";
import { formatJalaliDateTime } from "../lib/dates";
import { auditActionLabel, entityLabel } from "../lib/labels";

type Audit = {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  ip: string;
  userAgent: string;
  payloadSnippet: string;
};

type Res = { items: Audit[]; page: number; pageSize: number; total: number; sort: string };

export function AuditLogsPage() {
  const auth = useAuth();

  const [userId, setUserId] = React.useState("");
  const [action, setAction] = React.useState("");
  const [entity, setEntity] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "createdAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["audit", { userId, action, entity, from, to, page, pageSize, sortParam }],
    queryFn: () => {
      const qp = new URLSearchParams();
      if (userId) qp.set("userId", userId);
      if (action) qp.set("action", action);
      if (entity) qp.set("entity", entity);
      if (from) qp.set("from", from);
      if (to) qp.set("to", to);
      qp.set("page", String(page));
      qp.set("pageSize", String(pageSize));
      qp.set("sort", sortParam);
      return auth.api<Res>(`/audit-logs?${qp.toString()}`);
    },
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const qDetail = useQuery({
    queryKey: ["audit", "detail", selectedId],
    queryFn: () => auth.api<Audit>(`/audit-logs/${encodeURIComponent(selectedId!)}`),
    enabled: !!selectedId,
  });

  return (
    <Page
      title="لاگ ممیزی"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "لاگ ممیزی" },
      ]}
      hideFilters
    >
      <Card>
        <CardHeader>
          <CardTitle>فیلترها</CardTitle>
          <div />
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-12 items-end">
            <div className="md:col-span-3">
              <Label>شناسه کاربر</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="u_..." />
            </div>
            <div className="md:col-span-3">
              <Label>عملیات</Label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="dataset.upload" />
            </div>
            <div className="md:col-span-2">
              <Label>موجودیت</Label>
              <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="dataset" />
            </div>
            <div className="md:col-span-2">
              <Label>از</Label>
              <JalaliDateInput valueIso={from || null} onChangeIso={(v) => setFrom(v ?? "")} />
            </div>
            <div className="md:col-span-2">
              <Label>تا</Label>
              <JalaliDateInput valueIso={to || null} onChangeIso={(v) => setTo(v ?? "")} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-5">
        <DataTable
          title="رویدادها"
          loading={q.isLoading}
          data={q.data?.items ?? []}
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
          { id: "createdAt", header: "زمان", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
          { id: "userEmail", header: "کاربر", accessorKey: "userEmail" },
          {
            id: "action",
            header: "عملیات",
            accessorKey: "action",
            cell: (ctx) => {
              const code = String(ctx.getValue() ?? "");
              return (
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{auditActionLabel(code)}</div>
                  <div className="text-[11px] text-muted font-mono truncate">{code}</div>
                </div>
              );
            },
          },
          {
            id: "entity",
            header: "موجودیت",
            accessorKey: "entity",
            cell: (ctx) => {
              const code = String(ctx.getValue() ?? "");
              return (
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{entityLabel(code)}</div>
                  <div className="text-[11px] text-muted font-mono truncate">{code}</div>
                </div>
              );
            },
          },
          { id: "entityId", header: "شناسه موجودیت", accessorKey: "entityId", cell: (ctx) => <span className="font-mono text-[12px]">{String(ctx.getValue() ?? "")}</span> },
          {
            id: "detail",
            header: "",
              accessorKey: "id",
              cell: (ctx) => (
                <button className="text-primary hover:underline text-[12px]" onClick={() => setSelectedId(String(ctx.getValue()))}>
                  جزئیات
                </button>
              ),
            },
          ]}
          emptyTitle="لاگی وجود ندارد"
        />
      </div>

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="جزئیات لاگ">
        {qDetail.isLoading ? (
          <div className="text-[13px] text-muted">در حال بارگذاری...</div>
        ) : qDetail.data ? (
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[12px]">{qDetail.data.id}</div>
              <Badge tone="info">{formatJalaliDateTime(qDetail.data.createdAt)}</Badge>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div>
                <span className="text-muted">کاربر:</span> {qDetail.data.userEmail} ({qDetail.data.userId})
              </div>
              <div>
                <span className="text-muted">عملیات:</span> {qDetail.data.action}
              </div>
              <div>
                <span className="text-muted">موجودیت:</span> {qDetail.data.entity} {qDetail.data.entityId ?? ""}
              </div>
              <div>
                <span className="text-muted">IP:</span> {qDetail.data.ip}
              </div>
              <div className="mt-2">
                <div className="text-muted">مشخصات مرورگر/دستگاه:</div>
                <div className="text-[12px] break-words">{qDetail.data.userAgent}</div>
              </div>
              <div className="mt-2">
                <div className="text-muted">خلاصه داده:</div>
                <pre className="text-[12px] whitespace-pre-wrap">{qDetail.data.payloadSnippet}</pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-muted">یافت نشد</div>
        )}
      </Modal>
    </Page>
  );
}
