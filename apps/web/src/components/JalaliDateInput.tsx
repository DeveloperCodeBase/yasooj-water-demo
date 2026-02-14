import * as React from "react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { cn } from "../lib/cn";

function isoToPersian(iso: string | null): DateObject | null {
  if (!iso) return null;
  try {
    // Parse as a calendar date (no time) to avoid timezone surprises.
    const g = new DateObject({
      date: iso,
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: gregorian_en,
    });
    return new DateObject(g).convert(persian, persian_fa);
  } catch {
    return null;
  }
}

function persianToIso(v: unknown): string | null {
  if (!v) return null;
  try {
    const d = v as DateObject;
    const g = new DateObject(d).convert(gregorian, gregorian_en);
    return g.format("YYYY-MM-DD");
  } catch {
    return null;
  }
}

export function JalaliDateInput({
  valueIso,
  onChangeIso,
  placeholder,
  className,
  disabled,
}: {
  valueIso: string | null;
  onChangeIso: (nextIso: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const value = React.useMemo(() => isoToPersian(valueIso), [valueIso]);

  return (
    <div className={cn("w-full", className)}>
      <DatePicker
        value={value as any}
        onChange={(v) => {
          const iso = persianToIso(v);
          onChangeIso(iso);
        }}
        disabled={disabled}
        calendar={persian as any}
        locale={persian_fa as any}
        calendarPosition="bottom-right"
        format="YYYY/MM/DD"
        inputClass={cn(
          "w-full rounded-xl border border-border bg-card/60 px-3 py-2.5 text-[13px] text-right",
          "placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
        )}
        placeholder={placeholder ?? "----/--/--"}
        portal
        zIndex={60}
      />
    </div>
  );
}
