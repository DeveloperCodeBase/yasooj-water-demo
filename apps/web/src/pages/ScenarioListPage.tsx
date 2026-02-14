import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Badge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/badges";
import { formatJalaliDateTime } from "../lib/dates";
import { sspLabel, toFaDigits } from "../lib/labels";

type Scenario = {
  id: string;
  name: string;
  ssp: string;
  horizonFromYear: number;
  horizonToYear: number;
  method: string;
  status: "draft" | "running" | "ready" | "failed";
  lastRunAt?: string;
  createdAt: string;
};

type Res = { items: Scenario[]; page: number; pageSize: number; total: number; sort: string };

export function ScenarioListPage() {
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
    queryKey: ["scenarios", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/scenarios?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  return (
    <Page
      title="سناریوهای اقلیمی"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "سناریوهای اقلیمی" },
      ]}
      actions={
        <Link to="/scenarios/new">
          <Button variant="primary">
            <Plus size={16} />
            ایجاد سناریو
          </Button>
        </Link>
      }
    >
      <DataTable
        title="لیست سناریوها"
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
          { id: "ssp", header: "اس‌اس‌پی", accessorKey: "ssp", cell: (ctx) => <Badge tone="info">{sspLabel(String(ctx.getValue()))}</Badge> },
          {
            id: "horizon",
            header: "افق",
            accessorFn: (r) =>
              `${toFaDigits(String((r as any).horizonFromYear))} تا ${toFaDigits(String((r as any).horizonToYear))}`,
          },
          {
            id: "method",
            header: "روش",
            accessorKey: "method",
            cell: (ctx) => {
              const v = String(ctx.getValue() ?? "");
              const label = v === "LARS-WG" ? "مولد آب‌وهوایی" : v === "BiasCorrection" ? "تصحیح سوگیری" : v;
              return label;
            },
          },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          { id: "lastRunAt", header: "آخرین اجرا", accessorKey: "lastRunAt", cell: (ctx) => (ctx.getValue() ? formatJalaliDateTime(String(ctx.getValue())) : "—") },
          {
            id: "open",
            header: "",
            accessorKey: "id",
            cell: (ctx) => (
              <Link to={`/scenarios/${String(ctx.getValue())}`} className="text-primary hover:underline text-[12px]">
                نتایج
              </Link>
            ),
          },
        ]}
        emptyTitle="سناریویی وجود ندارد"
      />
    </Page>
  );
}
