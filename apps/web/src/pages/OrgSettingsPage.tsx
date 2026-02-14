import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { cn } from "../lib/cn";

type Org = {
  id: string;
  name: string;
  createdAt: string;
  settings: { units: { gwLevel: "m"; precip: "mm"; temp: "C" }; timezone: string; logoUrl?: string };
};

type FileRes = { filename: string; mimeType: string; contentBase64: string };

export function OrgSettingsPage() {
  const auth = useAuth();

  const q = useQuery({ queryKey: ["settings", "org"], queryFn: () => auth.api<Org>("/settings/org") });
  const org = q.data;

  const [name, setName] = React.useState("");
  const [timezone, setTimezone] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!org) return;
    setName(org.name);
    setTimezone(org.settings.timezone);
  }, [org]);

  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const logoKey = org?.settings.logoUrl ?? null;
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!org?.settings.logoUrl) {
        setLogoUrl(null);
        return;
      }
      // Default demo logo is served by web.
      if (org.settings.logoUrl === "/logo.svg") {
        setLogoUrl("/logo.svg");
        return;
      }
      try {
        const res = await auth.api<FileRes>(org.settings.logoUrl);
        const bin = atob(res.contentBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: res.mimeType });
        const url = URL.createObjectURL(blob);
        if (!cancelled) setLogoUrl(url);
      } catch {
        if (!cancelled) setLogoUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [auth, logoKey, org?.settings.logoUrl, org]);

  return (
    <Page
      title="تنظیمات سازمان"
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "تنظیمات" },
        { label: "سازمان" },
      ]}
      actions={
        org ? (
          <Button
            variant="primary"
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await auth.api("/settings/org", { method: "PATCH", body: JSON.stringify({ name: name.trim(), timezone: timezone.trim() }) });
                toast.success("ذخیره شد");
                await q.refetch();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            ذخیره
          </Button>
        ) : null
      }
      hideFilters
    >
      {!org ? (
        <Card>
          <CardBody>{q.isLoading ? "در حال بارگذاری..." : "یافت نشد"}</CardBody>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>مشخصات سازمان</CardTitle>
              <Badge tone="info">{org.id}</Badge>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>نام سازمان</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>منطقه زمانی</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Tehran" />
                </div>
              </div>
              <div className="mt-5">
                <div className="text-[12px] font-semibold">واحدها</div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>سطح آب</Label>
                    <Select value={org.settings.units.gwLevel} disabled>
                      <option value="m">متر</option>
                    </Select>
                  </div>
                  <div>
                    <Label>بارش</Label>
                    <Select value={org.settings.units.precip} disabled>
                      <option value="mm">میلی‌متر</option>
                    </Select>
                  </div>
                  <div>
                    <Label>دما</Label>
                    <Select value={org.settings.units.temp} disabled>
                      <option value="C">°C</option>
                    </Select>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>لوگو</CardTitle>
              <div />
            </CardHeader>
          <CardBody>
              <div className="text-[12px] text-muted">آپلود لوگو (دمو) از طریق سرویس</div>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl border border-border bg-card/60 grid place-items-center overflow-hidden">
                  {logoUrl ? <img src={logoUrl} alt="لوگو سازمان" className="h-14 w-14 object-contain" /> : <span className="text-muted">—</span>}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.append("file", f, f.name);
                      try {
                        const res = await auth.api<{ logoUrl: string }>("/settings/org/logo", { method: "POST", body: fd });
                        toast.success("آپلود شد");
                        await q.refetch();
                      } catch {
                        toast.error("خطا در آپلود");
                      } finally {
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <div className={cn("mt-2 text-[11px] text-muted text-right")}>
                    نمایش تصویر با پاسخ base64 انجام می‌شود (به دلیل احراز هویت).
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
