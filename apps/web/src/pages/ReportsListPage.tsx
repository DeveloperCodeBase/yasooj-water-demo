import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { SortingState } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus, Download } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Badge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/badges";
import { downloadBase64 } from "../lib/download";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";
import { reportTypeLabel } from "../lib/labels";

type Report = {
  id: string;
  title: string;
  type: "executive" | "technical" | "ops";
  createdAt: string;
  status: "ready" | "generating";
  sections: string[];
  filename: string;
};

type Res = { items: Report[]; page: number; pageSize: number; total: number; sort: string };
type DownloadRes = { filename: string; mimeType: string; contentBase64: string };

export function ReportsListPage() {
  const auth = useAuth();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);

  const sortParam = React.useMemo(() => {
    const s = sorting[0];
    if (!s) return "createdAt:desc";
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const q = useQuery({
    queryKey: ["reports", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/reports?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const download = async (id: string) => {
    try {
      const res = await auth.api<DownloadRes>(`/reports/${encodeURIComponent(id)}/download`);
      downloadBase64(res.filename, res.contentBase64, res.mimeType);
    } catch {
      toast.error("دانلود ناموفق بود");
    }
  };

  return (
    <Page
      title="گزارش‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "گزارش‌ها" },
      ]}
      actions={
        <Link to="/reports/new">
          <Button variant="primary">
            <Plus size={16} />
            ساخت گزارش
          </Button>
        </Link>
      }
    >
      <DataTable
        title="لیست گزارش‌ها"
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
          { id: "title", header: "عنوان", accessorKey: "title", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
          { id: "type", header: "نوع", accessorKey: "type", cell: (ctx) => <Badge tone="info">{reportTypeLabel(String(ctx.getValue()))}</Badge> },
          { id: "createdAt", header: "تاریخ", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          {
            id: "actions",
            header: "دانلود",
            accessorKey: "id",
            cell: (ctx) => {
              const row = ctx.row.original as any as Report;
              return (
                <div className={cn("flex items-center gap-2 flex-wrap")}>
                  <Button size="sm" onClick={() => void download(row.id)} disabled={row.status !== "ready"}>
                    <Download size={16} />
                    دانلود
                  </Button>
                </div>
              );
            },
          },
        ]}
        emptyTitle="گزارشی وجود ندارد"
      />
    </Page>
  );
}
