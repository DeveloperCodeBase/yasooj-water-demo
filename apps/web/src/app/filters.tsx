import React, { createContext, useContext, useMemo, useState } from "react";

export type GlobalFilters = {
  plainId: string | null;
  aquiferId: string | null;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  scenarioId: string | null;
};

type Ctx = {
  draft: GlobalFilters;
  applied: GlobalFilters;
  setDraft: (next: GlobalFilters) => void;
  apply: () => void;
  reset: () => void;
  appliedVersion: number;
};

const FiltersContext = createContext<Ctx | null>(null);

const DEFAULT: GlobalFilters = {
  plainId: "plain_1",
  aquiferId: null,
  from: "2025-01-01",
  to: "2025-12-01",
  scenarioId: "sc_1"
};

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<GlobalFilters>(() => {
    const raw = localStorage.getItem("filters");
    if (!raw) return DEFAULT;
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT, ...parsed };
    } catch {
      return DEFAULT;
    }
  });
  const [applied, setApplied] = useState<GlobalFilters>(draft);
  const [appliedVersion, setAppliedVersion] = useState(0);

  const apply = () => {
    setApplied(draft);
    setAppliedVersion((v) => v + 1);
    localStorage.setItem("filters", JSON.stringify(draft));
  };

  const reset = () => {
    setDraft(DEFAULT);
    setApplied(DEFAULT);
    setAppliedVersion((v) => v + 1);
    localStorage.setItem("filters", JSON.stringify(DEFAULT));
  };

  const value = useMemo<Ctx>(() => ({ draft, applied, setDraft, apply, reset, appliedVersion }), [draft, applied, appliedVersion]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}

