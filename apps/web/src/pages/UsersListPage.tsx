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

type UserRow = { id: string; name: string; email: string; role: string; status: string; lastLoginAt: string | null; createdAt: string };
type Res = { items: UserRow[]; page: number; pageSize: number; total: number; sort: string };

export function UsersListPage() {
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
    queryKey: ["users", { page, pageSize, sortParam }],
    queryFn: () => auth.api<Res>(`/users?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sortParam)}`),
  });

  const roleFa = (role: string) => {
    const r = String(role ?? "");
    if (r === "viewer") return "بیننده";
    if (r === "analyst") return "تحلیلگر";
    if (r === "admin") return "مدیر";
    if (r === "org_admin") return "مدیر سازمان";
    if (r === "super_admin") return "ابرمدیر";
    return role;
  };

  return (
    <Page
      title="مدیریت کاربران"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "کاربران" },
      ]}
      actions={
        <Link to="/users/new">
          <Button variant="primary">
            <Plus size={16} />
            ایجاد کاربر
          </Button>
        </Link>
      }
    >
      <DataTable
        title="لیست کاربران"
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
          { id: "email", header: "ایمیل", accessorKey: "email" },
          { id: "role", header: "نقش", accessorKey: "role", cell: (ctx) => <Badge tone="info">{roleFa(String(ctx.getValue()))}</Badge> },
          { id: "status", header: "وضعیت", accessorKey: "status", cell: (ctx) => <StatusBadge status={String(ctx.getValue())} /> },
          { id: "lastLoginAt", header: "آخرین ورود", accessorKey: "lastLoginAt", cell: (ctx) => (ctx.getValue() ? formatJalaliDateTime(String(ctx.getValue())) : "—") },
          {
            id: "actions",
            header: "",
            accessorKey: "id",
            cell: (ctx) => (
              <Link to={`/users/${String(ctx.getValue())}`} className="text-primary hover:underline text-[12px]">
                ویرایش
              </Link>
            ),
          },
        ]}
        emptyTitle="کاربری وجود ندارد"
      />
    </Page>
  );
}
