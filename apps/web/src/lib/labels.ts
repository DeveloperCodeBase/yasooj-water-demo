const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

export function toFaDigits(input: string) {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9]);
}

export function sspLabel(ssp: string) {
  const raw = String(ssp ?? "");
  const up = raw.toUpperCase();
  if (up.startsWith("SSP")) return `اس‌اس‌پی ${toFaDigits(up.slice(3))}`;
  return toFaDigits(raw);
}

export function confidenceLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "high") return "بالا";
  if (s === "medium") return "متوسط";
  if (s === "low") return "پایین";
  return v;
}

export function severityLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "critical") return "بحرانی";
  if (s === "warning") return "هشدار";
  if (s === "info") return "اطلاع";
  return v;
}

export function auditActionLabel(action: string) {
  const a = String(action ?? "");
  const map: Record<string, string> = {
    "auth.login": "ورود به سامانه",
    "auth.logout": "خروج از سامانه",
    "dataset.upload": "آپلود دیتاست",
    "dataset.validate": "اعتبارسنجی دیتاست",
    "dataset.publish": "انتشار دیتاست",
    "scenario.run": "اجرای سناریو",
    "model.train": "آموزش مدل",
    "forecast.run": "اجرای پیش‌بینی",
    "alert.trigger": "فعال‌شدن هشدار",
    "report.generate.requested": "درخواست تولید گزارش",
    "user.create": "ایجاد کاربر",
    "user.update": "ویرایش کاربر",
  };
  return map[a] ?? a;
}

export function entityLabel(entity: string) {
  const e = String(entity ?? "").toLowerCase();
  const map: Record<string, string> = {
    well: "چاه",
    dataset: "دیتاست",
    scenario: "سناریو",
    model: "مدل",
    forecast: "پیش‌بینی",
    alert: "هشدار",
    notification: "اعلان",
    report: "گزارش",
    user: "کاربر",
    org: "سازمان",
    session: "نشست",
    job: "کار",
  };
  return map[e] ?? entity;
}

export function datasetTypeLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "groundwater") return "آب زیرزمینی";
  if (s === "climate") return "اقلیم";
  if (s === "usage") return "مصرف/برداشت";
  if (s === "gis") return "اطلاعات مکانی";
  return v;
}

export function datasetSourceLabel(v: string) {
  const s = String(v ?? "");
  if (s === "ManualUpload") return "آپلود دستی";
  if (s === "API") return "اتصال سرویس";
  if (s === "Other") return "سایر";
  return v;
}

export function datasetFileStatusLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "uploaded") return "آپلود شده";
  if (s === "validated") return "اعتبارسنجی شده";
  return v;
}

export function reportTypeLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "executive") return "مدیریتی";
  if (s === "technical") return "فنی";
  if (s === "ops") return "عملیاتی";
  return v;
}

export function modelFamilyLabel(v: string) {
  const s = String(v ?? "").toUpperCase();
  if (s === "RF") return "جنگل تصادفی";
  if (s === "XGB") return "تقویت گرادیانی (ایکس‌جی‌بی)";
  if (s === "LSTM") return "شبکه بازگشتی (ال‌اس‌تی‌ام)";
  return v;
}
