import * as React from "react";
import { Badge } from "./ui";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Severity = "info" | "warning" | "critical";

export function RiskBadge({ level }: { level: RiskLevel }) {
  const tone = level === "critical" ? "danger" : level === "high" ? "warning" : level === "medium" ? "info" : "neutral";
  const label = level === "critical" ? "بحرانی" : level === "high" ? "زیاد" : level === "medium" ? "متوسط" : "کم";
  return <Badge tone={tone}>{label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s === "active" || s === "ready" || s === "enabled" ? "success" : s === "running" ? "info" : s === "failed" ? "danger" : s === "disabled" ? "warning" : "neutral";
  const label =
    s === "active"
      ? "فعال"
      : s === "inactive"
        ? "غیرفعال"
        : s === "enabled"
          ? "فعال"
          : s === "disabled"
            ? "غیرفعال"
            : s === "queued"
              ? "در صف"
              : s === "running"
                ? "در حال اجرا"
                : s === "ready"
                  ? "آماده"
                  : s === "success"
                    ? "موفق"
                    : s === "failed"
                      ? "ناموفق"
                      : s === "generating"
                        ? "در حال تولید"
                        : s === "draft"
                          ? "پیش‌نویس"
                          : s === "validated"
                            ? "اعتبارسنجی‌شده"
                            : s === "published"
                              ? "منتشرشده"
                              : s === "archived"
                                ? "بایگانی"
                                : s === "locked"
                                  ? "قفل"
                                  : s === "suspended"
                                    ? "معلق"
                                    : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone = severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info";
  const label = severity === "critical" ? "بحرانی" : severity === "warning" ? "هشدار" : "اطلاع";
  return <Badge tone={tone}>{label}</Badge>;
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <Badge tone="neutral">{children}</Badge>;
}
