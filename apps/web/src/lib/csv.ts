function esc(v: unknown) {
  const s = String(v ?? "");
  if (/[\",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
}

export function toCsv<T extends Record<string, any>>(
  items: T[],
  columns: Array<{ key: keyof T; label: string }>,
): string {
  const header = columns.map((c) => esc(c.label)).join(",");
  const lines = items.map((it) => columns.map((c) => esc(it[c.key])).join(","));
  return [header, ...lines].join("\n");
}

