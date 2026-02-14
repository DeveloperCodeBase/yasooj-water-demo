import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../app/auth";
import { cn } from "../lib/cn";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "./ui";
import { StatusBadge } from "./badges";

type Job = {
  id: string;
  type: string;
  status: "queued" | "running" | "success" | "failed";
  progress: number;
  steps: Array<{ name: string; status: "queued" | "running" | "success" | "failed" }>;
  logs: string[];
  errorMessage?: string;
};

export function JobProgressPanel({
  jobId,
  title,
  onSuccess,
}: {
  jobId: string;
  title?: string;
  onSuccess?: () => void;
}) {
  const auth = useAuth();

  const q = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => auth.api<Job>(`/jobs/${encodeURIComponent(jobId)}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 800;
      return data.status === "running" || data.status === "queued" ? 900 : false;
    },
  });

  const job = q.data;

  React.useEffect(() => {
    if (job?.status === "success") onSuccess?.();
  }, [job?.status, onSuccess]);

  const stepLabel = (name: string) => {
    const s = String(name ?? "");
    const map: Record<string, string> = {
      data_prep: "آماده‌سازی داده",
      train: "آموزش",
      validation: "اعتبارسنجی",
      package: "بسته‌بندی",
      packaging: "بسته‌بندی",
      artifacts: "ساخت خروجی‌ها",
      render: "رندر",
      store: "ذخیره‌سازی",
      assemble: "تجمیع",
    };
    return map[s] ?? s;
  };

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title ?? "وضعیت اجرا"}</CardTitle>
          <CardDescription className="truncate">{jobId}</CardDescription>
        </div>
        {job ? <StatusBadge status={job.status} /> : null}
      </CardHeader>
      <CardBody>
        {!job ? (
          <div className="text-[13px] text-muted">در حال دریافت...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-[12px] text-muted">
                <span>پیشرفت</span>
                <span>{job.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[12px] font-semibold">مراحل</div>
              <div className="grid gap-2">
                {job.steps.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 text-[13px]">
                    <div className="truncate">{stepLabel(s.name)}</div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[12px] font-semibold">لاگ‌ها</div>
              <div className={cn("mt-2 rounded-xl border border-border bg-black/[0.02] dark:bg-white/[0.03] p-3 text-[12px] text-muted max-h-[160px] overflow-auto text-right")}>
                {job.logs.slice(-30).map((l, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    {l}
                  </div>
                ))}
                {job.status === "failed" && job.errorMessage ? <div className="mt-2 text-danger">{job.errorMessage}</div> : null}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
