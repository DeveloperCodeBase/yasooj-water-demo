import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { SortingState } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Play, Zap } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Badge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/badges";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { modelFamilyLabel, toFaDigits } from "../lib/labels";

type Model = {
  id: string;
  name: string;
  family: "RF" | "XGB" | "LSTM";
  version: string;
  status: "draft" | "active" | "archived";
  trainedAt?: string;
  createdAt: string;
  metricsBadge?: string;
};

type Res = { items: Model[]; page: number; pageSize: number; total: number; sort: string };

export function ModelsListPage() {
  const auth = useAuth();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "trainedAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "trainedAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["models", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/models?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const canDeploy = auth.hasMinRole("admin");

  return (
    <Page
      title="مدل‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "مدل‌ها" },
      ]}
      actions={
        <Link to="/models/train">
          <Button variant="primary">
            <Play size={16} />
            آموزش مدل
          </Button>
        </Link>
      }
    >
      <DataTable
        title="رجیستری مدل"
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
          { id: "family", header: "خانواده", accessorKey: "family", cell: (ctx) => <Badge tone="info">{modelFamilyLabel(String(ctx.getValue()))}</Badge> },
          { id: "version", header: "نسخه", accessorKey: "version", cell: (ctx) => toFaDigits(String(ctx.getValue() ?? "")) },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          { id: "trainedAt", header: "آموزش", accessorKey: "trainedAt", cell: (ctx) => (ctx.getValue() ? formatJalaliDateTime(String(ctx.getValue())) : "—") },
          { id: "metricsBadge", header: "متریک", accessorKey: "metricsBadge", cell: (ctx) => toFaDigits(String(ctx.getValue() ?? "—")) },
          {
            id: "actions",
            header: "اقدام",
            accessorKey: "id",
            cell: (ctx) => {
              const row = ctx.row.original as any as Model;
              return (
                <div className={cn("flex items-center gap-2 flex-wrap")}>
                  <Link to={`/models/${row.id}`} className="text-primary hover:underline text-[12px]">
                    مشاهده
                  </Link>
                  {canDeploy ? (
                    <Button
                      size="sm"
                      disabled={row.status === "active"}
                      onClick={async () => {
                        try {
                          await auth.api(`/models/${encodeURIComponent(row.id)}/activate`, { method: "POST" });
                          toast.success("فعال شد");
                          await q.refetch();
                        } catch {
                          toast.error("خطا در فعال‌سازی");
                        }
                      }}
                    >
                      <Zap size={16} />
                      فعال‌سازی
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ]}
        emptyTitle="مدلی وجود ندارد"
        emptyDescription="یک مدل جدید آموزش دهید."
      />
    </Page>
  );
}
