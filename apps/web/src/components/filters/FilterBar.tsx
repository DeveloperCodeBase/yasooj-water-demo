import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../app/auth";
import { useFilters } from "../../app/filters";
import { Card, CardBody, Button, Label, Select } from "../ui";
import { cn } from "../../lib/cn";
import { JalaliDateInput } from "../JalaliDateInput";

type Plain = { id: string; nameFa: string; nameEn: string; province?: string };
type Aquifer = { id: string; plainId: string; nameFa: string; nameEn: string };
type Scenario = { id: string; name: string; ssp: string; horizonFromYear: number; horizonToYear: number; status: string; lastRunAt: string | null };

export function FilterBar() {
  const { t } = useTranslation();
  const auth = useAuth();
  const filters = useFilters();

  const plainsQ = useQuery({
    queryKey: ["lookups", "plains"],
    queryFn: () => auth.api<Plain[]>("/lookups/plains"),
  });

  const aquifersQ = useQuery({
    queryKey: ["lookups", "aquifers", filters.draft.plainId ?? "all"],
    queryFn: () => auth.api<Aquifer[]>(`/lookups/aquifers?plainId=${encodeURIComponent(filters.draft.plainId ?? "")}`),
    enabled: Boolean(filters.draft.plainId),
  });

  const scenariosQ = useQuery({
    queryKey: ["lookups", "scenarios"],
    queryFn: () => auth.api<Scenario[]>("/lookups/scenarios"),
  });

  const plains = plainsQ.data ?? [];
  const aquifers = aquifersQ.data ?? [];
  const scenarios = scenariosQ.data ?? [];

  const set = (patch: Partial<typeof filters.draft>) => filters.setDraft({ ...filters.draft, ...patch });

  // Keep aquifer valid when plain changes.
  React.useEffect(() => {
    if (!filters.draft.aquiferId) return;
    if (!aquifers.length) {
      set({ aquiferId: null });
      return;
    }
    const ok = aquifers.some((a) => a.id === filters.draft.aquiferId);
    if (!ok) set({ aquiferId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.draft.plainId, aquifersQ.data]);

  return (
    <Card>
      <CardBody className="py-3">
        <div className={cn("grid gap-3", "md:grid-cols-12")}>
          <div className="md:col-span-3">
            <Label>{t("filters.plain")}</Label>
            <Select
              value={filters.draft.plainId ?? ""}
              onChange={(e) => set({ plainId: e.target.value || null, aquiferId: null })}
              disabled={plainsQ.isLoading}
            >
              <option value="">همه</option>
              {plains.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameFa}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>{t("filters.aquifer")}</Label>
            <Select
              value={filters.draft.aquiferId ?? ""}
              onChange={(e) => set({ aquiferId: e.target.value || null })}
              disabled={!filters.draft.plainId || aquifersQ.isLoading}
            >
              <option value="">همه</option>
              {aquifers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameFa}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>{t("filters.from")}</Label>
            <JalaliDateInput valueIso={filters.draft.from} onChangeIso={(nextIso) => nextIso && set({ from: nextIso })} />
          </div>

          <div className="md:col-span-2">
            <Label>{t("filters.to")}</Label>
            <JalaliDateInput valueIso={filters.draft.to} onChangeIso={(nextIso) => nextIso && set({ to: nextIso })} />
          </div>

          <div className="md:col-span-2">
            <Label>{t("filters.scenario")}</Label>
            <Select value={filters.draft.scenarioId ?? ""} onChange={(e) => set({ scenarioId: e.target.value || null })} disabled={scenariosQ.isLoading}>
              <option value="">اقلیم فعلی</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className={cn("mt-3 flex items-center gap-2 justify-start flex-wrap")}>
          <Button variant="primary" onClick={() => filters.apply()}>
            {t("common.apply")}
          </Button>
          <Button onClick={() => filters.reset()}>{t("common.reset")}</Button>
        </div>
      </CardBody>
    </Card>
  );
}
