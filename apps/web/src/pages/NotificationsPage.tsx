import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { SortingState } from "@tanstack/react-table";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Card, CardBody, CardHeader, CardTitle, Badge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { SeverityBadge } from "../components/badges";
import { entityLabel } from "../lib/labels";

type Notification = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  readAt?: string;
  related?: { entity: string; entityId: string };
};

type Res = { items: Notification[]; page: number; pageSize: number; total: number; sort: string };

export function NotificationsPage() {
  const auth = useAuth();

  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "createdAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["notifications", { tab, page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/notifications?tab=${tab}&page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const [selected, setSelected] = React.useState<Notification | null>(null);

  const markRead = async (id: string) => {
    await auth.api(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
    await q.refetch();
  };

  return (
    <Page
      title="اعلان‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "اعلان‌ها" },
      ]}
      actions={
        <div className={cn("flex items-center gap-2 flex-wrap")}>
          <Button
            onClick={async () => {
              await auth.api("/notifications/read-all", { method: "POST" });
              toast.success("همه خوانده شدند");
              await q.refetch();
            }}
          >
            <CheckCheck size={16} />
            خواندن همه
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>تب‌ها</CardTitle>
          <div />
        </CardHeader>
        <CardBody>
          <div className={cn("flex items-center gap-2 flex-wrap")}>
            <button className={tab === "all" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("all")}>
              همه
            </button>
            <span className="text-muted/50">|</span>
            <button className={tab === "unread" ? "text-primary font-semibold" : "text-muted hover:text-text"} onClick={() => setTab("unread")}>
              خوانده‌نشده
            </button>
          </div>
        </CardBody>
      </Card>

      <div className="mt-5">
        <DataTable
          title="لیست اعلان‌ها"
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
            {
              id: "title",
              header: "عنوان",
              accessorKey: "title",
              cell: (ctx) => {
                const row = ctx.row.original as any as Notification;
                return (
                  <button className="text-right hover:underline" onClick={() => setSelected(row)}>
                    <div className="font-semibold">{row.title}</div>
                    <div className="text-[12px] text-muted max-w-[520px] truncate">{row.body}</div>
                  </button>
                );
              },
            },
            {
              id: "severity",
              header: "شدت",
              accessorKey: "severity",
              cell: (ctx) => {
                const sev = String(ctx.getValue()) as Notification["severity"];
                return <SeverityBadge severity={sev} />;
              },
            },
            { id: "createdAt", header: "زمان", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
            { id: "readAt", header: "وضعیت", accessorKey: "readAt", cell: (ctx) => (ctx.getValue() ? <Badge tone="success">خوانده شده</Badge> : <Badge tone="warning">جدید</Badge>) },
            {
              id: "actions",
              header: "",
              accessorKey: "id",
              cell: (ctx) => {
                const row = ctx.row.original as any as Notification;
                return (
                  <div className={cn("flex items-center gap-2 flex-wrap")}>
                    <button className="text-[12px] text-primary hover:underline" onClick={() => setSelected(row)}>
                      جزئیات
                    </button>
                    {!row.readAt ? (
                      <button className="text-[12px] text-muted hover:text-text" onClick={() => void markRead(row.id)}>
                        خواندن
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
          emptyTitle="اعلانی وجود ندارد"
        />
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="جزئیات اعلان">
        {selected ? (
          <div className="space-y-3">
            <div className={cn("flex items-start justify-between gap-3 flex-wrap")}>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{selected.title}</div>
                <div className="text-[12px] text-muted">{formatJalaliDateTime(selected.createdAt)}</div>
              </div>
              <SeverityBadge severity={selected.severity} />
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3 text-[13px] whitespace-pre-wrap">{selected.body}</div>
            {selected.related ? (
              <div className="text-[12px] text-muted">
                مرتبط با: <span className="font-semibold">{entityLabel(selected.related.entity)}</span> ·{" "}
                <span className="font-mono">{selected.related.entityId}</span>
              </div>
            ) : null}
            {!selected.readAt ? (
              <Button
                variant="primary"
                onClick={async () => {
                  await markRead(selected.id);
                  setSelected((s) => (s ? { ...s, readAt: new Date().toISOString() } : s));
                }}
              >
                <Bell size={16} />
                علامت‌گذاری به عنوان خوانده‌شده
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
