import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { SortingState } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus, FlaskConical, Power } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { SeverityBadge, StatusBadge } from "../components/badges";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";

type Alert = {
  id: string;
  name: string;
  severity: "info" | "warning" | "critical";
  status: "enabled" | "disabled";
  lastTriggeredAt?: string;
  updatedAt: string;
};

type Res = { items: Alert[]; page: number; pageSize: number; total: number; sort: string };

export function AlertsListPage() {
  const auth = useAuth();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "updatedAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["alerts", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/alerts?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  return (
    <Page
      title="هشدارها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "هشدارها" },
      ]}
      actions={
        <Link to="/alerts/new">
          <Button variant="primary">
            <Plus size={16} />
            ساخت هشدار
          </Button>
        </Link>
      }
    >
      <DataTable
        title="لیست هشدارها"
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
          { id: "name", header: "نام", accessorKey: "name", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
          { id: "severity", header: "شدت", accessorKey: "severity", cell: (ctx) => <SeverityBadge severity={ctx.getValue() as any} /> },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          { id: "lastTriggeredAt", header: "آخرین اجرا", accessorKey: "lastTriggeredAt", cell: (ctx) => (ctx.getValue() ? formatJalaliDateTime(String(ctx.getValue())) : "—") },
          {
            id: "actions",
            header: "اقدام",
            accessorKey: "id",
            cell: (ctx) => {
              const row = ctx.row.original as any as Alert;
              return (
                <div className={cn("flex items-center gap-2 flex-wrap")}>
                  <Link to={`/alerts/${row.id}`} className="text-primary hover:underline text-[12px]">
                    ویرایش
                  </Link>
                  <Link to={`/alerts/${row.id}/history`} className="text-primary hover:underline text-[12px]">
                    تاریخچه
                  </Link>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await auth.api<{ summary: string }>(`/alerts/${encodeURIComponent(row.id)}/test`, { method: "POST" });
                        toast.success(res.summary);
                        await q.refetch();
                      } catch {
                        toast.error("خطا در تست هشدار");
                      }
                    }}
                  >
                    <FlaskConical size={16} />
                    تست
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await auth.api(`/alerts/${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ status: row.status === "enabled" ? "disabled" : "enabled" }) });
                        toast.success("بروزرسانی شد");
                        await q.refetch();
                      } catch {
                        toast.error("خطا در بروزرسانی");
                      }
                    }}
                  >
                    <Power size={16} />
                    {row.status === "enabled" ? "غیرفعال" : "فعال"}
                  </Button>
                </div>
              );
            },
          },
        ]}
        emptyTitle="هشداری وجود ندارد"
      />
    </Page>
  );
}
