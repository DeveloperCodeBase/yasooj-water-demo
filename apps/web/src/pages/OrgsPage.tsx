import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { cn } from "../lib/cn";
import { formatJalaliDateTime } from "../lib/dates";

type Org = { id: string; name: string; createdAt: string };
type Res = { items: Org[] };

export function OrgsPage() {
  const auth = useAuth();

  const q = useQuery({ queryKey: ["orgs"], queryFn: () => auth.api<Res>("/orgs") });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [edit, setEdit] = React.useState<Org | null>(null);
  const [editName, setEditName] = React.useState("");

  React.useEffect(() => {
    if (!edit) return;
    setEditName(edit.name);
  }, [edit]);

  return (
    <Page
      title="مدیریت سازمان‌ها"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "سازمان‌ها" },
      ]}
      hideFilters
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          سازمان جدید
        </Button>
      }
    >
      <DataTable
        title="لیست سازمان‌ها"
        loading={q.isLoading}
        data={q.data?.items ?? []}
        columns={[
          { id: "id", header: "شناسه", accessorKey: "id", cell: (ctx) => <span className="font-mono text-[12px]">{String(ctx.getValue())}</span> },
          { id: "name", header: "نام", accessorKey: "name", cell: (ctx) => <span className="font-semibold">{String(ctx.getValue())}</span> },
          { id: "createdAt", header: "ایجاد", accessorKey: "createdAt", cell: (ctx) => formatJalaliDateTime(String(ctx.getValue())) },
          {
            id: "actions",
            header: "",
            accessorKey: "id",
            cell: (ctx) => {
              const row = ctx.row.original as any as Org;
              return (
                <button className="text-primary hover:underline text-[12px]" onClick={() => setEdit(row)}>
                  ویرایش
                </button>
              );
            },
          },
        ]}
        emptyTitle="سازمانی وجود ندارد"
      />

      <Modal
        open={createOpen}
        title="ایجاد سازمان"
        onClose={() => {
          if (!busy) setCreateOpen(false);
        }}
        footer={
          <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
            <Button
              variant="primary"
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  await auth.api("/orgs", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
                  toast.success("ایجاد شد");
                  setCreateOpen(false);
                  setName("");
                  await q.refetch();
                } catch {
                  toast.error("خطا در ایجاد سازمان");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save size={16} />
              ذخیره
            </Button>
            <Button disabled={busy} onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div>
          <Label>نام سازمان</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="..." />
        </div>
      </Modal>

      <Modal
        open={!!edit}
        title="ویرایش سازمان"
        onClose={() => setEdit(null)}
        footer={
          <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
            <Button
              variant="primary"
              disabled={busy || editName.trim().length < 2}
              onClick={async () => {
                if (!edit) return;
                setBusy(true);
                try {
                  await auth.api(`/orgs/${encodeURIComponent(edit.id)}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim() }) });
                  toast.success("ذخیره شد");
                  setEdit(null);
                  await q.refetch();
                } catch {
                  toast.error("خطا در ذخیره");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save size={16} />
              ذخیره
            </Button>
            <Button disabled={busy} onClick={() => setEdit(null)}>
              انصراف
            </Button>
          </div>
        }
      >
        {edit ? (
          <div className="space-y-3">
            <div className="text-[12px] text-muted">
              شناسه: <span className="font-mono">{edit.id}</span>
            </div>
            <div>
              <Label>نام</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
