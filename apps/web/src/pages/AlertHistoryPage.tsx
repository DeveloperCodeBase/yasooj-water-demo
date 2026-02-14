import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Badge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";

type HistoryItem = {
  id: string;
  alertId: string;
  triggeredAt: string;
  wellsAffected: string[];
  summary: string;
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
};

type Res = { items: HistoryItem[] };

export function AlertHistoryPage() {
  const auth = useAuth();
  const { id } = useParams();

  const q = useQuery({
    queryKey: ["alert", id, "history"],
    queryFn: () => auth.api<Res>(`/alerts/${encodeURIComponent(id!)}/history`),
    enabled: !!id,
  });

  const [selected, setSelected] = React.useState<HistoryItem | null>(null);

  const ack = async (historyId: string) => {
    await auth.api(`/alerts/history/${encodeURIComponent(historyId)}/ack`, { method: "POST" });
    toast.success("ثبت شد");
    await q.refetch();
  };

  return (
    <Page
      title="تاریخچه هشدار"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "هشدارها", to: "/alerts" },
        { label: id ?? "" },
        { label: "تاریخچه" },
      ]}
      actions={
        id ? (
          <Link to={`/alerts/${id}`}>
            <Button>ویرایش</Button>
          </Link>
        ) : null
      }
    >
      <DataTable
        title="رویدادها"
        loading={q.isLoading}
        data={q.data?.items ?? []}
        columns={[
          { id: "triggeredAt", header: "زمان", accessorKey: "triggeredAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
          { id: "wellsAffected", header: "تعداد چاه", accessorKey: "wellsAffected", cell: (ctx) => (Array.isArray(ctx.getValue()) ? (ctx.getValue() as any[]).length : 0) },
          { id: "summary", header: "خلاصه", accessorKey: "summary" },
          {
            id: "ack",
            header: "وضعیت",
            accessorKey: "acknowledgedAt",
            cell: (ctx) =>
              ctx.getValue() ? <Badge tone="success">تایید شده</Badge> : <Badge tone="warning">باز</Badge>,
          },
          {
            id: "actions",
            header: "",
            accessorKey: "id",
            cell: (ctx) => {
              const row = ctx.row.original as any as HistoryItem;
              return (
                <div className={cn("flex items-center gap-2 flex-wrap")}>
                  <button className="text-primary hover:underline text-[12px]" onClick={() => setSelected(row)}>
                    جزئیات
                  </button>
                  {!row.acknowledgedAt ? (
                    <Button size="sm" onClick={() => void ack(row.id)}>
                      <CheckCircle2 size={16} />
                      تایید
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ]}
        emptyTitle="موردی وجود ندارد"
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="جزئیات">
        {selected ? (
          <div className="space-y-3">
            <div className="text-[12px] text-muted">{formatJalaliDateTime(selected.triggeredAt)}</div>
            <div className="rounded-2xl border border-border bg-card/60 p-3 text-[13px]">{selected.summary}</div>
            <div className="text-[12px] text-muted">
              چاه‌ها: {(selected.wellsAffected ?? []).join(", ")}
            </div>
            {!selected.acknowledgedAt ? (
              <Button
                variant="primary"
                onClick={async () => {
                  await ack(selected.id);
                  setSelected(null);
                }}
              >
                تایید
              </Button>
            ) : (
              <div className="text-[12px] text-muted">
                تایید شده در: {formatJalaliDateTime(selected.acknowledgedAt)}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
