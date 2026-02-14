import * as React from "react";
import type { ColumnDef, RowSelectionState, SortingState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "../lib/cn";
import { Button, Card, CardBody, CardHeader, CardTitle, Select } from "./ui";
import { Skeleton } from "./states";

export function DataTable<T>({
  title,
  data,
  columns,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  emptyTitle,
  emptyDescription,
}: {
  title?: React.ReactNode;
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (next: RowSelectionState) => void;
  getRowId?: (row: T, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const canPaginate = typeof page === "number" && typeof pageSize === "number" && typeof total === "number" && !!onPageChange;
  const pageCount = canPaginate ? Math.max(1, Math.ceil(total! / pageSize!)) : 1;

  const nf = React.useMemo(() => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }), []);
  const defaultColumn = React.useMemo(
    () => ({
      cell: (ctx: any) => {
        const v = ctx.getValue?.() ?? null;
        if (v === null || v === undefined || v === "") return "—";
        if (typeof v === "number" && Number.isFinite(v)) return nf.format(v);
        if (typeof v === "string") {
          const s = v.trim();
          if (s && /^-?\d+(\.\d+)?$/.test(s)) return nf.format(Number(s));
          return v;
        }
        return String(v);
      },
    }),
    [nf]
  );

  const table = useReactTable({
    data,
    columns,
    getRowId,
    defaultColumn,
    state: {
      sorting: sorting ?? [],
      rowSelection: rowSelection ?? {},
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting ?? []) : updater;
      onSortingChange?.(next);
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
      onRowSelectionChange?.(next);
    },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: !!onRowSelectionChange,
  });

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <div />
        </CardHeader>
      ) : null}
      <CardBody className="p-0">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-[12px] md:text-[13px]">
            <thead className="bg-black/[0.02] dark:bg-white/[0.03]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    const sort = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        className={cn(
                          "text-start font-semibold text-[11px] md:text-[12px] text-muted px-2.5 md:px-3 py-2.5 md:py-3 border-b border-border whitespace-nowrap",
                          canSort ? "cursor-pointer select-none hover:text-text" : ""
                        )}
                        onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      >
                        <div className={cn("flex items-center gap-2 justify-start")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort ? <span className="text-[10px] opacity-70">{sort === "desc" ? "▼" : "▲"}</span> : null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: Math.max(3, Math.min(8, pageSize ?? 6)) }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-2.5 md:px-3 py-2.5 md:py-3 border-b border-border" colSpan={columns.length}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : data.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2.5 md:px-3 py-2.5 md:py-3 border-b border-border align-top whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-muted" colSpan={columns.length}>
                    <div className="text-[13px] font-semibold text-text">{emptyTitle ?? "داده‌ای یافت نشد"}</div>
                    {emptyDescription ? <div className="mt-2 text-[12px] text-muted">{emptyDescription}</div> : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canPaginate ? (
          <div className={cn("px-3 py-3 flex items-center gap-2 flex-wrap")}>
            <div className="text-[12px] text-muted">
              صفحه {nf.format(page!)} از {nf.format(pageCount)}
            </div>
            <Button size="sm" onClick={() => onPageChange(Math.max(1, page! - 1))} disabled={page! <= 1}>
              قبلی
            </Button>
            <Button size="sm" onClick={() => onPageChange(Math.min(pageCount, page! + 1))} disabled={page! >= pageCount}>
              بعدی
            </Button>
            {onPageSizeChange ? (
              <div className="w-[120px]">
                <Select
                  value={String(pageSize)}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                  {[10, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {`${nf.format(n)} ردیف`}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
