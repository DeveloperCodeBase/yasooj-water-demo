const TZ = "Asia/Tehran";

function safeDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatJalaliDate(isoOrDate: string) {
  const d = safeDate(isoOrDate);
  if (!d) return isoOrDate;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatJalaliMonth(isoOrDate: string) {
  const d = safeDate(isoOrDate);
  if (!d) return isoOrDate;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function formatJalaliDateTime(isoOrDate: string) {
  const d = safeDate(isoOrDate);
  if (!d) return isoOrDate;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

