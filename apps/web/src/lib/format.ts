const NF2 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export function formatFaNumber(value: unknown, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(n)) return String(value);
  if (maximumFractionDigits === 0) return NF0.format(n);
  if (maximumFractionDigits === 2) return NF2.format(n);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits }).format(n);
}

export function formatFaPercentFromRatio(ratio0to1: unknown, digits = 0) {
  const r = typeof ratio0to1 === "number" ? ratio0to1 : Number(String(ratio0to1));
  if (!Number.isFinite(r)) return "—";
  const pct = r * 100;
  return `${formatFaNumber(pct, digits)}٪`;
}

