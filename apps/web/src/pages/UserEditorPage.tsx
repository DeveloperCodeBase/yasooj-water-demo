import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { KeyRound, LogOut, Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { cn } from "../lib/cn";

type User = { id: string; name: string; email: string; role: string; status: string; lastLoginAt?: string | null; createdAt: string };

export function UserEditorPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const { id } = useParams();

  const isNew = !id;
  const qUser = useQuery({
    queryKey: ["user", id],
    queryFn: () => auth.api<User>(`/users/${encodeURIComponent(id!)}`),
    enabled: !!id,
    retry: false,
  });

  const u = qUser.data;
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("viewer");
  const [status, setStatus] = React.useState("active");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!u) return;
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setStatus(u.status);
  }, [u]);

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await auth.api<{ id: string; tempPassword: string }>("/users", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: email.trim(), role, status }),
        });
        toast.success(`کاربر ایجاد شد. رمز موقت: ${res.tempPassword}`);
        nav(`/users/${res.id}`);
        return;
      }
      await auth.api(`/users/${encodeURIComponent(id!)}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), role, status }) });
      toast.success("ذخیره شد");
      await qUser.refetch();
    } catch (e: any) {
      toast.error("خطا در ذخیره کاربر");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!id) return;
    const res = await auth.api<{ resetLink: string }>(`/users/${encodeURIComponent(id)}/reset-password`, { method: "POST" });
    toast.success("لینک ریست تولید شد");
    window.open(res.resetLink, "_blank", "noopener,noreferrer");
  };

  const forceLogout = async () => {
    if (!id) return;
    await auth.api(`/users/${encodeURIComponent(id)}/force-logout`, { method: "POST" });
    toast.success("خروج اجباری انجام شد");
  };

  return (
    <Page
      title={isNew ? "ایجاد کاربر" : "ویرایش کاربر"}
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "کاربران", to: "/users" },
        { label: isNew ? "جدید" : id ?? "" },
      ]}
      actions={
        <div className={cn("flex items-center gap-2 flex-wrap")}>
          <Button variant="primary" disabled={busy || name.trim().length < 2 || (!id && !email.trim())} onClick={() => void save()}>
            <Save size={16} />
            ذخیره
          </Button>
        </div>
      }
      hideFilters
    >
      {!isNew && qUser.isLoading ? (
        <Card>
          <CardBody>در حال بارگذاری...</CardBody>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>مشخصات</CardTitle>
              {u ? <Badge tone="info">{u.id}</Badge> : <div />}
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>نام</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>ایمیل</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isNew} placeholder="user@demo.local" />
                </div>
                <div>
                  <Label>نقش</Label>
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="viewer">بیننده</option>
                    <option value="analyst">تحلیلگر</option>
                    <option value="admin">مدیر</option>
                    <option value="org_admin">مدیر سازمان</option>
                    <option value="super_admin">ابرمدیر</option>
                  </Select>
                </div>
                <div>
                  <Label>وضعیت</Label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">فعال</option>
                    <option value="suspended">معلق</option>
                    <option value="locked">قفل</option>
                  </Select>
                </div>
              </div>
              <div className="mt-4 text-[12px] text-muted">
                نکته: رمز اولیه در پاسخ سرویس بازگردانده می‌شود (دمو).
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>عملیات</CardTitle>
              <div />
            </CardHeader>
            <CardBody>
              {!id ? (
                <div className="text-[12px] text-muted">پس از ایجاد کاربر، عملیات دیگر فعال می‌شود.</div>
              ) : (
                <div className="space-y-3">
                  <Button onClick={() => void resetPassword()}>
                    <KeyRound size={16} />
                    ریست رمز (دمو)
                  </Button>
                  <Button onClick={() => void forceLogout()}>
                    <LogOut size={16} />
                    خروج اجباری
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
