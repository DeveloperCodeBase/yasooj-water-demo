import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { KeyRound, User } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { cn } from "../lib/cn";

type Profile = { id: string; name: string; email: string; role: string; status: string; language: "fa"; theme: "light" | "dark" };

export function ProfileSettingsPage() {
  const auth = useAuth();

  const q = useQuery({ queryKey: ["settings", "profile"], queryFn: () => auth.api<Profile>("/settings/profile") });

  const p = q.data;
  const [name, setName] = React.useState("");

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!p) return;
    setName(p.name);
  }, [p]);

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
      title="تنظیمات پروفایل"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "تنظیمات" },
        { label: "پروفایل" },
      ]}
      hideFilters
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>پروفایل</CardTitle>
            {p ? <Badge tone="info">{roleFa(p.role)}</Badge> : <div />}
          </CardHeader>
          <CardBody>
            {!p ? (
              <div className="text-[13px] text-muted">در حال بارگذاری...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>نام</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>ایمیل</Label>
                    <Input value={p.email} disabled />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>پوسته</Label>
                    <Select value={auth.theme} onChange={(e) => void auth.setTheme(e.target.value as any)}>
                      <option value="light">روشن</option>
                      <option value="dark">تیره</option>
                    </Select>
                  </div>
                </div>

                <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
                  <Button
                    variant="primary"
                    disabled={busy || !name.trim() || name.trim() === p.name}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await auth.api("/settings/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
                        toast.success("ذخیره شد");
                        await q.refetch();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <User size={16} />
                    ذخیره
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تغییر رمز عبور</CardTitle>
            <div />
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div>
                <Label>رمز عبور فعلی</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
                <div>
                  <Label>رمز عبور جدید</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <div className="mt-1 text-[12px] text-muted">حداقل ۸ کاراکتر</div>
                </div>
              <div className={cn("flex items-center gap-2 justify-start flex-wrap")}>
                <Button
                  variant="primary"
                  disabled={busy || !currentPassword || newPassword.length < 8}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await auth.api("/settings/profile", {
                        method: "PATCH",
                        body: JSON.stringify({ currentPassword, newPassword }),
                      });
                      toast.success("رمز عبور تغییر کرد");
                      setCurrentPassword("");
                      setNewPassword("");
                    } catch (e: any) {
                      toast.error("خطا در تغییر رمز عبور");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <KeyRound size={16} />
                  تغییر
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
