import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { SortingState } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/badges";
import { formatJalaliDateTime } from "../lib/dates";
import { confidenceLabel, toFaDigits } from "../lib/labels";

type Forecast = {
  id: string;
  scenarioId: string | null;
  modelId: string;
  wellIds: string[];
  horizonMonths: number;
  status: "running" | "ready" | "failed";
  createdAt: string;
  confidence: "low" | "medium" | "high";
};

type Res = { items: Forecast[]; page: number; pageSize: number; total: number; sort: string };
type ScenarioLookup = { id: string; name: string };
type ModelLookup = { id: string; name: string };

export function ForecastsListPage() {
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
    queryKey: ["forecasts", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/forecasts?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const scenariosQ = useQuery({
    queryKey: ["lookups", "scenarios"],
    queryFn: () => auth.api<ScenarioLookup[]>("/lookups/scenarios"),
  });
  const modelsQ = useQuery({
    queryKey: ["lookups", "models"],
    queryFn: () => auth.api<ModelLookup[]>("/lookups/models"),
  });

  const scenarioName = React.useMemo(() => new Map((scenariosQ.data ?? []).map((s) => [s.id, s.name] as const)), [scenariosQ.data]);
  const modelName = React.useMemo(() => new Map((modelsQ.data ?? []).map((m) => [m.id, m.name] as const)), [modelsQ.data]);

  return (
    <Page
      title="پیش‌بینی‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "پیش‌بینی‌ها" },
      ]}
      actions={
        <Link to="/forecasts/run">
          <Button variant="primary">
            <Plus size={16} />
            اجرای پیش‌بینی
          </Button>
        </Link>
      }
    >
      <DataTable
        title="لیست پیش‌بینی‌ها"
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
          { id: "id", header: "شناسه", accessorKey: "id", cell: (ctx) => <span className="font-mono text-[12px]">{String(ctx.getValue())}</span> },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          {
            id: "confidence",
            header: "اعتماد",
            accessorKey: "confidence",
            cell: (ctx) => <Badge tone="info">{confidenceLabel(String(ctx.getValue()))}</Badge>,
          },
          { id: "modelId", header: "مدل", accessorKey: "modelId", cell: (ctx) => modelName.get(String(ctx.getValue())) ?? String(ctx.getValue()) },
          {
            id: "scenarioId",
            header: "سناریو",
            accessorKey: "scenarioId",
            cell: (ctx) => {
              const v = ctx.getValue();
              if (!v) return "اقلیم فعلی";
              return scenarioName.get(String(v)) ?? String(v);
            },
          },
          { id: "horizonMonths", header: "افق", accessorKey: "horizonMonths", cell: (ctx) => `${toFaDigits(String(ctx.getValue()))} ماه` },
          { id: "wells", header: "تعداد چاه", accessorKey: "wellIds", cell: (ctx) => (Array.isArray(ctx.getValue()) ? toFaDigits(String((ctx.getValue() as any[]).length)) : "۰") },
          { id: "createdAt", header: "تاریخ اجرا", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
          {
            id: "open",
            header: "",
            accessorKey: "id",
            cell: (ctx) => (
              <Link className="text-primary hover:underline text-[12px]" to={`/forecasts/${String(ctx.getValue())}`}>
                مشاهده
              </Link>
            ),
          },
        ]}
        emptyTitle="پیش‌بینی‌ای وجود ندارد"
        emptyDescription="یک پیش‌بینی جدید اجرا کنید."
      />
    </Page>
  );
}
