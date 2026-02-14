import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../app/auth";
import { Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Select, Button } from "./ui";
import { cn } from "../lib/cn";

type Plain = { id: string; nameFa: string; nameEn: string };
type Aquifer = { id: string; plainId: string; nameFa: string; nameEn: string };
type WellLookup = { id: string; code: string; name: string; riskLevel: string; dataQualityScore: number };

export type AlertDraft = {
  name: string;
  severity: "info" | "warning" | "critical";
  status: "enabled" | "disabled";
  scope: { plainIds: string[]; aquiferIds: string[]; wellIds: string[] };
  conditionType: "gw_level_below" | "drop_rate_above" | "prob_cross_threshold_above" | "data_quality_below";
  params: Record<string, any>;
  channels: { inApp: boolean; email: boolean };
};

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function RuleBuilder({
  value,
  onChange,
}: {
  value: AlertDraft;
  onChange: (next: AlertDraft) => void;
}) {
  const auth = useAuth();

  const plainsQ = useQuery({ queryKey: ["lookups", "plains"], queryFn: () => auth.api<Plain[]>("/lookups/plains") });
  const aquifersQ = useQuery({ queryKey: ["lookups", "aquifers", "all"], queryFn: () => auth.api<Aquifer[]>("/lookups/aquifers") });
  const [wellSearch, setWellSearch] = React.useState("");
  const wellsQ = useQuery({
    queryKey: ["lookups", "wells", wellSearch],
    queryFn: () => auth.api<WellLookup[]>(`/lookups/wells?limit=80&search=${encodeURIComponent(wellSearch)}`),
  });

  const plains = plainsQ.data ?? [];
  const aquifers = aquifersQ.data ?? [];
  const wells = wellsQ.data ?? [];

  const set = (patch: Partial<AlertDraft>) => onChange({ ...value, ...patch });

  const paramBlock = () => {
    if (value.conditionType === "gw_level_below") {
      return (
        <div>
          <Label>آستانه (متر)</Label>
          <Input
            type="number"
            step="0.01"
            value={String(value.params.thresholdM ?? 1100)}
            onChange={(e) => set({ params: { ...value.params, thresholdM: Number(e.target.value) } })}
          />
        </div>
      );
    }
    if (value.conditionType === "drop_rate_above") {
      return (
        <div>
          <Label>آستانه (متر/ماه)</Label>
          <Input
            type="number"
            step="0.01"
            value={String(value.params.threshold ?? 0.6)}
            onChange={(e) => set({ params: { ...value.params, threshold: Number(e.target.value) } })}
          />
        </div>
      );
    }
    if (value.conditionType === "prob_cross_threshold_above") {
      return (
        <div>
          <Label>آستانه (٪)</Label>
          <Input
            type="number"
            step="1"
            value={String(value.params.thresholdPct ?? 70)}
            onChange={(e) => set({ params: { ...value.params, thresholdPct: Number(e.target.value) } })}
          />
        </div>
      );
    }
    return (
      <div>
        <Label>حداقل کیفیت (۰ تا ۱۰۰)</Label>
        <Input
          type="number"
          step="1"
          value={String(value.params.minScore ?? 60)}
          onChange={(e) => set({ params: { ...value.params, minScore: Number(e.target.value) } })}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>ساخت هشدار</CardTitle>
          <CardDescription>دامنه + شرط + کانال‌ها</CardDescription>
        </div>
        <Button variant="ghost" onClick={() => set({ scope: { plainIds: [], aquiferIds: [], wellIds: [] } })}>
          پاک کردن دامنه
        </Button>
      </CardHeader>
      <CardBody>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>نام</Label>
            <Input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="نام هشدار" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>شدت</Label>
              <Select value={value.severity} onChange={(e) => set({ severity: e.target.value as any })}>
                <option value="info">اطلاع</option>
                <option value="warning">هشدار</option>
                <option value="critical">بحرانی</option>
              </Select>
            </div>
            <div>
              <Label>وضعیت</Label>
              <Select value={value.status} onChange={(e) => set({ status: e.target.value as any })}>
                <option value="enabled">فعال</option>
                <option value="disabled">غیرفعال</option>
              </Select>
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>نوع شرط</Label>
            <Select
              value={value.conditionType}
              onChange={(e) => {
                const ct = e.target.value as AlertDraft["conditionType"];
                const defaults =
                  ct === "gw_level_below"
                    ? { thresholdM: 1100 }
                    : ct === "drop_rate_above"
                      ? { threshold: 0.6 }
                      : ct === "prob_cross_threshold_above"
                        ? { thresholdPct: 70 }
                        : { minScore: 60 };
                set({ conditionType: ct, params: defaults });
              }}
            >
              <option value="gw_level_below">سطح آب زیر آستانه</option>
              <option value="drop_rate_above">نرخ افت بالای آستانه</option>
              <option value="prob_cross_threshold_above">احتمال عبور از آستانه</option>
              <option value="data_quality_below">کیفیت داده پایین</option>
            </Select>
            <div className="mt-3">{paramBlock()}</div>
          </div>

          <div className="md:col-span-2">
            <Label>کانال‌ها</Label>
            <div className={cn("mt-2 flex items-center gap-3 text-[13px] justify-start flex-wrap")}>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                  checked={value.channels.inApp}
                  onChange={(e) => set({ channels: { ...value.channels, inApp: e.target.checked } })}
                />
                <span>درون برنامه</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                  checked={value.channels.email}
                  onChange={(e) => set({ channels: { ...value.channels, email: e.target.checked } })}
                />
                <span>ایمیل (دمو)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold">دشت‌ها</div>
            <div className="mt-2 rounded-2xl border border-border overflow-auto max-h-[260px]">
              {plains.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                    checked={value.scope.plainIds.includes(p.id)}
                    onChange={() => set({ scope: { ...value.scope, plainIds: toggleId(value.scope.plainIds, p.id) } })}
                  />
                  <span className="truncate">{p.nameFa}</span>
                </label>
              ))}
              {!plains.length ? <div className="px-3 py-3 text-[12px] text-muted">بدون داده</div> : null}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold">آبخوان‌ها</div>
            <div className="mt-2 rounded-2xl border border-border overflow-auto max-h-[260px]">
              {aquifers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                    checked={value.scope.aquiferIds.includes(a.id)}
                    onChange={() => set({ scope: { ...value.scope, aquiferIds: toggleId(value.scope.aquiferIds, a.id) } })}
                  />
                  <span className="truncate">{a.nameFa}</span>
                </label>
              ))}
              {!aquifers.length ? <div className="px-3 py-3 text-[12px] text-muted">بدون داده</div> : null}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[12px] font-semibold">چاه‌ها</div>
              <div className="w-full sm:w-[160px]">
                <Input value={wellSearch} onChange={(e) => setWellSearch(e.target.value)} placeholder="جستجو" />
              </div>
            </div>
            <div className="mt-2 rounded-2xl border border-border overflow-auto max-h-[260px]">
              {wells.map((w) => (
                <label key={w.id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-[13px] justify-start">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                    checked={value.scope.wellIds.includes(w.id)}
                    onChange={() => set({ scope: { ...value.scope, wellIds: toggleId(value.scope.wellIds, w.id) } })}
                  />
                  <span className="truncate">
                    {w.code} <span className="text-muted/70">({w.dataQualityScore})</span>
                  </span>
                </label>
              ))}
              {!wells.length ? <div className="px-3 py-3 text-[12px] text-muted">بدون داده</div> : null}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
