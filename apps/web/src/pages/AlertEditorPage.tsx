import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FlaskConical, Save } from "lucide-react";
import { useAuth } from "../app/auth";
import { Page } from "../components/Page";
import { Button, Card, CardBody, CardHeader, CardTitle } from "../components/ui";
import { RuleBuilder, type AlertDraft } from "../components/RuleBuilder";
import { Modal } from "../components/Modal";
import { cn } from "../lib/cn";
import { RiskBadge } from "../components/badges";

type Alert = AlertDraft & {
  id: string;
  orgId: string;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function AlertEditorPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const { id } = useParams();

  const isNew = !id;

  const qAlert = useQuery({
    queryKey: ["alert", id],
    queryFn: () => auth.api<Alert>(`/alerts/${encodeURIComponent(id!)}`),
    enabled: !!id,
    retry: false,
  });

  const [draft, setDraft] = React.useState<AlertDraft>({
    name: "",
    severity: "warning",
    status: "enabled",
    scope: { plainIds: [], aquiferIds: [], wellIds: [] },
    conditionType: "gw_level_below",
    params: { thresholdM: 1100 },
    channels: { inApp: true, email: false },
  });

  React.useEffect(() => {
    if (!qAlert.data) return;
    const a = qAlert.data;
    setDraft({
      name: a.name,
      severity: a.severity,
      status: a.status,
      scope: a.scope,
      conditionType: a.conditionType,
      params: a.params ?? {},
      channels: a.channels ?? { inApp: true, email: false },
    });
  }, [qAlert.data]);

  const [busy, setBusy] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testResult, setTestResult] = React.useState<any>(null);

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) {
        const res = await auth.api<{ id: string }>("/alerts", { method: "POST", body: JSON.stringify(draft) });
        toast.success("ایجاد شد");
        nav(`/alerts/${res.id}`);
        return;
      }
      await auth.api(`/alerts/${encodeURIComponent(id!)}`, { method: "PATCH", body: JSON.stringify(draft) });
      toast.success("ذخیره شد");
      await qAlert.refetch();
    } catch {
      toast.error("خطا در ذخیره هشدار");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!id) return;
    try {
      const res = await auth.api<any>(`/alerts/${encodeURIComponent(id)}/test`, { method: "POST" });
      setTestResult(res);
      setTestOpen(true);
      toast.success(res.summary ?? "تست انجام شد");
    } catch {
      toast.error("خطا در تست هشدار");
    }
  };

  return (
    <Page
      title={isNew ? "ساخت هشدار" : "ویرایش هشدار"}
      crumbs={[
        { label: "داشبورد", to: "/dashboard" },
        { label: "هشدارها", to: "/alerts" },
        { label: isNew ? "جدید" : id ?? "" },
      ]}
      actions={
        <div className={cn("flex items-center gap-2 flex-wrap")}>
          <Button variant="primary" onClick={() => void save()} disabled={busy || draft.name.trim().length < 2}>
            <Save size={16} />
            ذخیره
          </Button>
          {!isNew ? (
            <Button onClick={() => void test()} disabled={busy || qAlert.isLoading}>
              <FlaskConical size={16} />
              تست
            </Button>
          ) : null}
          {!isNew ? (
            <Link to={`/alerts/${id}/history`}>
              <Button>تاریخچه</Button>
            </Link>
          ) : null}
        </div>
      }
    >
      {!isNew && qAlert.isLoading ? (
        <Card>
          <CardBody>در حال بارگذاری...</CardBody>
        </Card>
      ) : (
        <RuleBuilder value={draft} onChange={setDraft} />
      )}

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="نتیجه تست">
        {testResult ? (
          <div className="space-y-3">
            <div className="text-[13px] font-semibold">{testResult.summary}</div>
            <div className="text-[12px] text-muted">
              چاه‌های متاثر: {(testResult.affectedWells ?? []).length}
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3 text-[12px] text-muted max-h-[240px] overflow-auto">
              {(testResult.affectedWells ?? []).map((w: any) => (
                <div key={w.id} className="flex items-center justify-between gap-3 py-1">
                  <div className="font-mono">{w.code}</div>
                  <RiskBadge level={w.riskLevel} />
                </div>
              ))}
            </div>
            {testResult.historyId && id ? (
              <Link to={`/alerts/${id}/history`} className="text-primary hover:underline text-[12px]">
                مشاهده تاریخچه
              </Link>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
