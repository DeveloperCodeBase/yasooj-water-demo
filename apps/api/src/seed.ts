import bcrypt from "bcryptjs";
import { clamp, isoNow } from "./utils.js";
import type {
  Alert,
  AlertHistoryItem,
  Aquifer,
  AuditLog,
  Dataset,
  DatasetFile,
  DatasetValidation,
  DbData,
  Forecast,
  ForecastSeriesPoint,
  ForecastWellResult,
  Job,
  Model,
  ModelMetrics,
  Notification,
  Org,
  Plain,
  Report,
  RiskLevel,
  Scenario,
  ScenarioResults,
  User,
  Well,
  WellNote,
  WellTimeseriesPoint,
} from "./types.js";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededIntFromString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function monthStartIso(year: number, month1to12: number): string {
  const d = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score < 0.25) return "low";
  if (score < 0.5) return "medium";
  if (score < 0.75) return "high";
  return "critical";
}

const SEED_VERSION = 3;

export async function createSeedDb(): Promise<DbData> {
  const seededAt = isoNow();
  const rng = mulberry32(seededIntFromString("yasooj-water-dss-demo"));
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const orgs: Org[] = [
    {
      id: "org_1",
      name: "دمو سامانه تصمیم‌یار آب زیرزمینی یاسوج",
      createdAt: seededAt,
      settings: {
        units: { gwLevel: "m", precip: "mm", temp: "C" },
        timezone: "Asia/Tehran",
        logoUrl: "/logo.svg",
      },
    },
  ];

  const users: User[] = [
    {
      id: "u_viewer",
      orgId: "org_1",
      name: "بیننده دمو",
      email: "viewer@demo.local",
      role: "viewer",
      status: "active",
      passwordHash,
      language: "fa",
      theme: "light",
      createdAt: seededAt,
    },
    {
      id: "u_analyst",
      orgId: "org_1",
      name: "تحلیلگر دمو",
      email: "analyst@demo.local",
      role: "analyst",
      status: "active",
      passwordHash,
      language: "fa",
      theme: "light",
      createdAt: seededAt,
    },
    {
      id: "u_admin",
      orgId: "org_1",
      name: "مدیر دمو",
      email: "admin@demo.local",
      role: "admin",
      status: "active",
      passwordHash,
      language: "fa",
      theme: "light",
      createdAt: seededAt,
    },
    {
      id: "u_org_admin",
      orgId: "org_1",
      name: "مدیر سازمان دمو",
      email: "orgadmin@demo.local",
      role: "org_admin",
      status: "active",
      passwordHash,
      language: "fa",
      theme: "light",
      createdAt: seededAt,
    },
    {
      id: "u_super_admin",
      orgId: "org_1",
      name: "ابرمدیر دمو",
      email: "superadmin@demo.local",
      role: "super_admin",
      status: "active",
      passwordHash,
      language: "fa",
      theme: "light",
      createdAt: seededAt,
    },
  ];

  const plains: Plain[] = [
    {
      id: "plain_1",
      province: "کهگیلویه و بویراحمد",
      nameFa: "دشت یاسوج",
      nameEn: "Yasooj Plain",
    },
    {
      id: "plain_2",
      province: "کهگیلویه و بویراحمد",
      nameFa: "دشت سی‌سخت",
      nameEn: "Sisakht Plain",
    },
    {
      id: "plain_3",
      province: "کهگیلویه و بویراحمد",
      nameFa: "دشت مارگون",
      nameEn: "Margoon Plain",
    },
  ];

  const aquifers: Aquifer[] = [
    { id: "aq_1", plainId: "plain_1", nameFa: "آبخوان یاسوج-شمال", nameEn: "Yasooj North Aquifer" },
    { id: "aq_2", plainId: "plain_1", nameFa: "آبخوان یاسوج-جنوب", nameEn: "Yasooj South Aquifer" },
    { id: "aq_3", plainId: "plain_2", nameFa: "آبخوان سی‌سخت-مرکزی", nameEn: "Sisakht Central Aquifer" },
    { id: "aq_4", plainId: "plain_2", nameFa: "آبخوان سی‌سخت-غرب", nameEn: "Sisakht West Aquifer" },
    { id: "aq_5", plainId: "plain_3", nameFa: "آبخوان مارگون-کوهپایه", nameEn: "Margoon Foothills Aquifer" },
    { id: "aq_6", plainId: "plain_3", nameFa: "آبخوان مارگون-دشت", nameEn: "Margoon Plain Aquifer" },
  ];

  // Build wells + 60 monthly points (2021-01 .. 2025-12)
  const wells: Well[] = [];
  const wellTimeseries: WellTimeseriesPoint[] = [];
  const wellNotes: WellNote[] = [];

  const start = monthStartIso(2021, 1);
  const months = 60;

  const plainWellPrefixes = [
    { plainId: "plain_1", aquiferIds: ["aq_1", "aq_2"], prefix: "YAS", lat0: 30.66, lon0: 51.59, base: 1125 },
    { plainId: "plain_2", aquiferIds: ["aq_3", "aq_4"], prefix: "SIS", lat0: 30.89, lon0: 51.46, base: 1138 },
    { plainId: "plain_3", aquiferIds: ["aq_5", "aq_6"], prefix: "MAR", lat0: 31.09, lon0: 51.68, base: 1112 },
  ] as const;

  for (const group of plainWellPrefixes) {
    for (let i = 1; i <= 10; i++) {
      const wellId = `well_${group.prefix.toLowerCase()}_${String(i).padStart(3, "0")}`;
      const code = `${group.prefix}-${String(i).padStart(3, "0")}`;
      const aquiferId = group.aquiferIds[i % 2];
      const depthM = Math.round(120 + rng() * 180);
      const lat = group.lat0 + (rng() - 0.5) * 0.12;
      const lon = group.lon0 + (rng() - 0.5) * 0.12;

      // Trend (negative means dropping). 0.25..0.65 m/month drop.
      const dropPerMonth = 0.25 + rng() * 0.4;
      const seasonalAmp = 0.4 + rng() * 0.35;
      const noiseAmp = 0.08 + rng() * 0.12;

      // Missing months: 2..6 points
      const missingCount = 2 + Math.floor(rng() * 5);
      const missingSet = new Set<number>();
      while (missingSet.size < missingCount) missingSet.add(Math.floor(rng() * months));

      // Anomalies: 1..3 points (avoid missing)
      const anomalyCount = 1 + Math.floor(rng() * 3);
      const anomalySet = new Set<number>();
      while (anomalySet.size < anomalyCount) {
        const idx = Math.floor(rng() * months);
        if (!missingSet.has(idx)) anomalySet.add(idx);
      }

      const baseLevel = group.base + (rng() - 0.5) * 10 + (i - 5) * 0.4;

      const levels: Array<number | null> = [];
      const dates: string[] = [];

      for (let m = 0; m < months; m++) {
        const date = addMonthsISO(start, m);
        dates.push(date);

        const month = new Date(date).getUTCMonth() + 1;
        const seasonal = Math.sin(((month - 1) / 12) * Math.PI * 2) * seasonalAmp;
        const noise = (rng() - 0.5) * noiseAmp;

        // Climate (shared-ish)
        const precipSeason = Math.max(0, 1.15 - Math.cos(((month - 1) / 12) * Math.PI * 2)); // winter higher
        const precipMm = clamp(precipSeason * (25 + rng() * 35) + (rng() - 0.5) * 8, 0, 180);
        const tmeanC = clamp(16 + Math.sin(((month - 1) / 12) * Math.PI * 2) * 10 + (rng() - 0.5) * 2, -5, 42);

        let gwLevelM = baseLevel - dropPerMonth * m + seasonal + noise;

        if (anomalySet.has(m)) {
          gwLevelM += (rng() - 0.5) * 4.5; // spike
        }

        if (missingSet.has(m)) {
          levels.push(null);
          wellTimeseries.push({
            id: `wts_${wellId}_${m}`,
            wellId,
            date,
            gwLevelM: null,
            precipMm: Number(precipMm.toFixed(1)),
            tmeanC: Number(tmeanC.toFixed(1)),
            flags: { missing: true },
          });
          continue;
        }

        levels.push(Number(gwLevelM.toFixed(2)));
        wellTimeseries.push({
          id: `wts_${wellId}_${m}`,
          wellId,
          date,
          gwLevelM: Number(gwLevelM.toFixed(2)),
          precipMm: Number(precipMm.toFixed(1)),
          tmeanC: Number(tmeanC.toFixed(1)),
          flags: anomalySet.has(m) ? { anomaly: true } : {},
        });
      }

      const lastIdx = [...levels.keys()].reverse().find((idx) => levels[idx] !== null);
      const latestGwLevelM = lastIdx === undefined ? null : (levels[lastIdx] as number);
      const prevIdx = lastIdx === undefined ? undefined : [...levels.keys()].reverse().find((idx) => idx < lastIdx && levels[idx] !== null);
      const change30dM =
        lastIdx === undefined || prevIdx === undefined ? null : Number(((levels[lastIdx] as number) - (levels[prevIdx] as number)).toFixed(2));

      const missingPct = missingSet.size / months;
      const anomalyPct = anomalySet.size / (months - missingSet.size);
      const dataQualityScore = Math.round(clamp((1 - missingPct) * 80 + (1 - anomalyPct) * 20, 35, 98));

      // Drop rate over last 12 months (if possible)
      let monthlyDropRate = 0.35;
      if (lastIdx !== undefined) {
        const lookback = Math.max(0, lastIdx - 12);
        const idx12 = [...levels.keys()].reverse().find((idx) => idx <= lookback && levels[idx] !== null);
        if (idx12 !== undefined && latestGwLevelM !== null && levels[idx12] !== null && lastIdx - idx12 >= 6) {
          monthlyDropRate = clamp(((levels[idx12] as number) - latestGwLevelM) / (lastIdx - idx12), 0, 1.2);
        }
      }

      const riskScore = clamp((monthlyDropRate / 0.9) * 0.7 + ((100 - dataQualityScore) / 100) * 0.3, 0, 1);
      const riskLevel = riskLevelFromScore(riskScore);
      const lastUpdate = dates[months - 1];
      const tags = [
        group.prefix.toLowerCase(),
        riskLevel === "critical" ? "priority" : null,
        riskLevel === "high" ? "watchlist" : null,
      ].filter(Boolean) as string[];

      wells.push({
        id: wellId,
        code,
        name: `چاه ${code}`,
        plainId: group.plainId,
        aquiferId,
        status: rng() > 0.08 ? "active" : "inactive",
        tags,
        depthM,
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        monitoringFrequency: "monthly",
        latestGwLevelM: latestGwLevelM === null ? null : Number(latestGwLevelM.toFixed(2)),
        change30dM,
        dataQualityScore,
        riskScore: Number(riskScore.toFixed(3)),
        riskLevel,
        lastUpdate,
        createdAt: seededAt,
      });

      if (rng() > 0.6) {
        wellNotes.push({
          id: `note_${wellId}_1`,
          wellId,
          authorUserId: "u_analyst",
          body: "بازدید میدانی انجام شد. نیاز به کالیبراسیون سنسور دارد. (دمو)",
          createdAt: isoNow(),
        });
      }
    }
  }

  // Seed datasets + files + validations
  const datasets: Dataset[] = [
    {
      id: "ds_1",
      orgId: "org_1",
      name: "پایش آب زیرزمینی (۲۰۲۱ تا ۲۰۲۵)",
      type: "groundwater",
      source: "ManualUpload",
      description: "مشاهدات ماهانه سطح آب زیرزمینی برای ۳۰ چاه (دمو).",
      version: "1.2.0",
      status: "published",
      releaseNotes: "افزودن داده‌های سه‌ماهه چهارم ۲۰۲۵ + فلگ‌های کیفیت.",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "ds_2",
      orgId: "org_1",
      name: "پایه اقلیم (مشاهدات)",
      type: "climate",
      source: "API",
      description: "سری پایه بارش و دما (دمو).",
      version: "1.0.1",
      status: "published",
      releaseNotes: "بازاجرای تجمیع.",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "ds_3",
      orgId: "org_1",
      name: "مصرف آب (دمو)",
      type: "usage",
      source: "Other",
      description: "برآورد برداشت آب به تفکیک دشت (دمو).",
      version: "0.3.0",
      status: "validated",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "ds_4",
      orgId: "org_1",
      name: "مرزبندی جی‌آی‌اس (دشت‌ها/آبخوان‌ها)",
      type: "gis",
      source: "ManualUpload",
      description: "مرزهای ساده‌شده پلیگونی (دمو).",
      version: "0.1.0",
      status: "draft",
      createdAt: seededAt,
      updatedAt: seededAt,
    },
  ];

  const datasetFiles: DatasetFile[] = [
    {
      id: "dsf_1",
      datasetId: "ds_1",
      filename: "gw_monitoring_2021_2025.csv",
      sizeBytes: 418_200,
      status: "validated",
      uploadedAt: seededAt,
    },
    {
      id: "dsf_2",
      datasetId: "ds_2",
      filename: "climate_baseline_monthly.csv",
      sizeBytes: 182_900,
      status: "validated",
      uploadedAt: seededAt,
    },
    {
      id: "dsf_3",
      datasetId: "ds_3",
      filename: "usage_mock.xlsx",
      sizeBytes: 52_300,
      status: "validated",
      uploadedAt: seededAt,
    },
  ];

  const datasetValidations: DatasetValidation[] = [
    {
      id: "dsv_1",
      datasetId: "ds_1",
      validatedAt: seededAt,
      summary: { rows: 1800, columns: 7, missingPct: 3.2, invalidDatePct: 0.1, duplicates: 2 },
      errors: [
        { column: "gwLevelM", errorType: "outlier", rowIndex: 244, message: "مقدار خارج از بازه مورد انتظار است." },
        { column: "date", errorType: "invalid_format", rowIndex: 917, message: "فرمت تاریخ معتبر نیست." },
      ],
      completenessByColumn: [
        { column: "date", completeness: 1 },
        { column: "wellCode", completeness: 1 },
        { column: "gwLevelM", completeness: 0.968 },
        { column: "precipMm", completeness: 0.996 },
        { column: "tmeanC", completeness: 0.995 },
      ],
    },
    {
      id: "dsv_2",
      datasetId: "ds_3",
      validatedAt: seededAt,
      summary: { rows: 360, columns: 5, missingPct: 1.1, invalidDatePct: 0, duplicates: 0 },
      errors: [{ column: "usage", errorType: "missing", rowIndex: 41, message: "مقدار خالی است." }],
      completenessByColumn: [
        { column: "plainId", completeness: 1 },
        { column: "month", completeness: 1 },
        { column: "usage", completeness: 0.989 },
      ],
    },
  ];

  const scenarios: Scenario[] = [
    {
      id: "sc_1",
      orgId: "org_1",
      name: "سناریوی مبنا (اس‌اس‌پی ۲-۴.۵) ۲۰۲۶ تا ۲۰۵۰",
      ssp: "SSP2-4.5",
      horizonFromYear: 2026,
      horizonToYear: 2050,
      method: "LARS-WG",
      plainIds: ["plain_1", "plain_2", "plain_3"],
      status: "ready",
      lastRunAt: seededAt,
      createdAt: seededAt,
    },
    {
      id: "sc_2",
      orgId: "org_1",
      name: "سناریوی گرم و خشک (اس‌اس‌پی ۵-۸.۵) ۲۰۲۶ تا ۲۰۵۰",
      ssp: "SSP5-8.5",
      horizonFromYear: 2026,
      horizonToYear: 2050,
      method: "BiasCorrection",
      plainIds: ["plain_1", "plain_2"],
      status: "ready",
      lastRunAt: seededAt,
      createdAt: seededAt,
    },
  ];

  const scenarioResults: ScenarioResults[] = [];
  for (const sc of scenarios) {
    for (const plainId of sc.plainIds) {
      const annual: Array<{ year: number; tmean: number; precip: number }> = [];
      for (let y = sc.horizonFromYear; y <= Math.min(sc.horizonToYear, sc.horizonFromYear + 24); y++) {
        const tBase = 18.2 + (sc.ssp === "SSP5-8.5" ? 0.35 : 0.18) * (y - sc.horizonFromYear);
        const pBase = 410 - (sc.ssp === "SSP5-8.5" ? 3.2 : 1.2) * (y - sc.horizonFromYear);
        annual.push({
          year: y,
          tmean: Number((tBase + (rng() - 0.5) * 0.25).toFixed(2)),
          precip: Number((pBase + (rng() - 0.5) * 12).toFixed(1)),
        });
      }

      const monthlyDist: Array<{ month: number; tmean: number; precip: number }> = [];
      for (let m = 1; m <= 12; m++) {
        const t = 16 + Math.sin(((m - 1) / 12) * Math.PI * 2) * 10 + (sc.ssp === "SSP5-8.5" ? 1.4 : 0.6);
        const p = clamp(
          (40 + Math.cos(((m - 1) / 12) * Math.PI * 2) * 18) * (sc.ssp === "SSP5-8.5" ? 0.8 : 0.92),
          0,
          140,
        );
        monthlyDist.push({ month: m, tmean: Number(t.toFixed(1)), precip: Number(p.toFixed(1)) });
      }

      scenarioResults.push({
        id: `scr_${sc.id}_${plainId}`,
        scenarioId: sc.id,
        plainId,
        annual,
        monthlyDist,
        extremes: {
          max1DayPrecip: Number((65 + rng() * 30 * (sc.ssp === "SSP5-8.5" ? 0.85 : 1)).toFixed(1)),
          heatDays: Math.round(18 + rng() * 18 + (sc.ssp === "SSP5-8.5" ? 10 : 3)),
        },
      });
    }
  }

  const models: Model[] = [
    {
      id: "m_1",
      orgId: "org_1",
      name: "ایکس‌جی‌بی نسخه ۲",
      family: "XGB",
      version: "2.0.0",
      status: "active",
      trainedAt: seededAt,
      createdAt: seededAt,
      metricsBadge: "RMSE ۱٫۸",
    },
    {
      id: "m_2",
      orgId: "org_1",
      name: "جنگل تصادفی نسخه ۱",
      family: "RF",
      version: "1.1.0",
      status: "archived",
      trainedAt: seededAt,
      createdAt: seededAt,
      metricsBadge: "RMSE ۲٫۲",
    },
    {
      id: "m_3",
      orgId: "org_1",
      name: "ال‌اس‌تی‌ام نسخه ۰",
      family: "LSTM",
      version: "0.4.0",
      status: "draft",
      createdAt: seededAt,
    },
  ];

  const modelMetrics: ModelMetrics[] = [
    {
      id: "mm_1",
      modelId: "m_1",
      metrics: { rmse: 1.8, mae: 1.2, r2: 0.83, nse: 0.71 },
      residuals: Array.from({ length: 120 }).map((_, i) => {
        const actual = 1100 + (rng() - 0.5) * 20;
        const res = (rng() - 0.5) * 3.2;
        return { actual: Number(actual.toFixed(2)), pred: Number((actual - res).toFixed(2)), res: Number(res.toFixed(2)) };
      }),
      featureImportance: [
        { feature: "precip_lag_2", importance: 0.18 },
        { feature: "tmean", importance: 0.12 },
        { feature: "gwLevel_lag_1", importance: 0.22 },
        { feature: "gwLevel_lag_6", importance: 0.09 },
        { feature: "seasonality", importance: 0.07 },
      ],
    },
    {
      id: "mm_2",
      modelId: "m_2",
      metrics: { rmse: 2.2, mae: 1.6, r2: 0.78, nse: 0.62 },
      residuals: Array.from({ length: 120 }).map(() => {
        const actual = 1100 + (rng() - 0.5) * 20;
        const res = (rng() - 0.5) * 4.2;
        return { actual: Number(actual.toFixed(2)), pred: Number((actual - res).toFixed(2)), res: Number(res.toFixed(2)) };
      }),
      featureImportance: [
        { feature: "gwLevel_lag_1", importance: 0.26 },
        { feature: "precip", importance: 0.11 },
        { feature: "tmean", importance: 0.1 },
      ],
    },
  ];

  // Forecasts (seed a ready forecast + series for 10 wells)
  const forecasts: Forecast[] = [];
  const forecastSeries: ForecastSeriesPoint[] = [];
  const forecastWellResults: ForecastWellResult[] = [];

  const seededForecastWellIds = wells.slice(0, 10).map((w) => w.id);
  const fc: Forecast = {
    id: "fc_1",
    orgId: "org_1",
    scenarioId: "sc_1",
    modelId: "m_1",
    wellIds: seededForecastWellIds,
    horizonMonths: 24,
    status: "ready",
    createdAt: seededAt,
    createdByUserId: "u_analyst",
    confidence: "medium",
  };
  forecasts.push(fc);

  const fcStart = monthStartIso(2026, 1);
  for (const wellId of seededForecastWellIds) {
    const well = wells.find((w) => w.id === wellId)!;
    const lastObs = well.latestGwLevelM ?? 1100;
    const baseDrop = 0.22 + rng() * 0.28;
    for (let m = 0; m < fc.horizonMonths; m++) {
      const date = addMonthsISO(fcStart, m);
      const p50 = lastObs - baseDrop * (m + 1) + Math.sin((m / 12) * Math.PI * 2) * 0.25;
      const sigma = 0.6 + (m / fc.horizonMonths) * 1.1;
      const p10 = p50 - sigma * 1.1;
      const p90 = p50 + sigma * 1.1;
      forecastSeries.push({
        id: `fcs_${fc.id}_${wellId}_${m}`,
        forecastId: fc.id,
        wellId,
        date,
        p10: Number(p10.toFixed(2)),
        p50: Number(p50.toFixed(2)),
        p90: Number(p90.toFixed(2)),
      });
    }
    const final = forecastSeries.filter((s) => s.forecastId === fc.id && s.wellId === wellId).slice(-1)[0];
    const threshold = (well.latestGwLevelM ?? lastObs) - 12; // mock threshold
    const probCross = clamp(0.15 + (baseDrop / 0.5) * 0.5 + (1 - well.dataQualityScore / 100) * 0.2, 0, 0.98);
    const expectedDropRate = Number(baseDrop.toFixed(2));
    const riskScore = clamp(probCross * 0.7 + (expectedDropRate / 0.7) * 0.3, 0, 1);
    forecastWellResults.push({
      forecastId: fc.id,
      wellId,
      wellCode: well.code,
      p50FinalLevel: final.p50,
      probCrossThreshold: Number(probCross.toFixed(2)),
      expectedDropRate,
      riskLevel: riskLevelFromScore(riskScore),
    });
    void threshold;
  }

  const alerts: Alert[] = [
    {
      id: "al_1",
      orgId: "org_1",
      name: "هشدار بحرانی: سطح آب زیرزمینی کمتر از آستانه",
      severity: "critical",
      status: "enabled",
      scope: { plainIds: ["plain_1"], aquiferIds: [], wellIds: [] },
      conditionType: "gw_level_below",
      params: { thresholdM: 1100 },
      channels: { inApp: true, email: false },
      lastTriggeredAt: seededAt,
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "al_2",
      orgId: "org_1",
      name: "هشدار: نرخ افت بیشتر از ۰٫۶ متر در ماه",
      severity: "warning",
      status: "enabled",
      scope: { plainIds: ["plain_2", "plain_3"], aquiferIds: [], wellIds: [] },
      conditionType: "drop_rate_above",
      params: { threshold: 0.6 },
      channels: { inApp: true, email: true },
      lastTriggeredAt: seededAt,
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    {
      id: "al_3",
      orgId: "org_1",
      name: "اطلاع: کیفیت داده پایین (کمتر از ۶۰)",
      severity: "info",
      status: "enabled",
      scope: { plainIds: [], aquiferIds: [], wellIds: [] },
      conditionType: "data_quality_below",
      params: { minScore: 60 },
      channels: { inApp: true, email: false },
      createdAt: seededAt,
      updatedAt: seededAt,
    },
  ];

  const alertHistory: AlertHistoryItem[] = [
    {
      id: "alh_1",
      alertId: "al_1",
      triggeredAt: seededAt,
      wellsAffected: wells.filter((w) => w.plainId === "plain_1" && (w.latestGwLevelM ?? 9999) < 1100).slice(0, 5).map((w) => w.id),
      summary: "۵ چاه کمتر از آستانه (۱۱۰۰ متر).",
    },
    {
      id: "alh_2",
      alertId: "al_2",
      triggeredAt: seededAt,
      wellsAffected: wells.filter((w) => ["plain_2", "plain_3"].includes(w.plainId) && w.riskLevel !== "low").slice(0, 6).map((w) => w.id),
      summary: "۶ چاه با ریسک بالای نرخ افت.",
    },
  ];

  const notifications: Notification[] = [];
  const notifUsers = ["u_viewer", "u_analyst", "u_admin", "u_org_admin", "u_super_admin"];
  for (let i = 0; i < 24; i++) {
    const u = notifUsers[i % notifUsers.length];
    const sev = i % 7 === 0 ? "critical" : i % 3 === 0 ? "warning" : "info";
    notifications.push({
      id: `nt_${i + 1}`,
      orgId: "org_1",
      userId: u,
      title: sev === "critical" ? "هشدار بحرانی" : sev === "warning" ? "هشدار" : "اطلاع",
      body:
        sev === "critical"
          ? "احتمال عبور از آستانه در چند چاه افزایش یافته است. (دمو)"
          : sev === "warning"
            ? "کاهش سطح آبخوان در حال تشدید است. (دمو)"
            : "عملیات جدید ثبت شد. (دمو)",
      severity: sev,
      createdAt: isoNow(),
      readAt: i % 4 === 0 ? isoNow() : undefined,
      related: i % 2 === 0 ? { entity: "forecast", entityId: "fc_1" } : { entity: "well", entityId: wells[i % wells.length].id },
    });
  }

  const reports: Report[] = [
    {
      id: "rp_1",
      orgId: "org_1",
      title: "گزارش مدیریتی ماهانه (دمو)",
      type: "executive",
      createdAt: seededAt,
      status: "ready",
      sections: ["kpis", "scenario_summary", "risk_table", "alerts_summary"],
      filename: "executive_demo_1.html",
    },
    {
      id: "rp_2",
      orgId: "org_1",
      title: "گزارش فنی مدل (دمو)",
      type: "technical",
      createdAt: seededAt,
      status: "ready",
      sections: ["kpis", "forecast_charts", "data_quality"],
      filename: "technical_demo_1.html",
    },
    {
      id: "rp_3",
      orgId: "org_1",
      title: "گزارش عملیات پایش (دمو)",
      type: "ops",
      createdAt: seededAt,
      status: "ready",
      sections: ["kpis", "alerts_summary"],
      filename: "ops_demo_1.html",
    },
    {
      id: "rp_4",
      orgId: "org_1",
      title: "خلاصه هفتگی مدیریتی (دمو)",
      type: "executive",
      createdAt: seededAt,
      status: "ready",
      sections: ["kpis", "risk_table"],
      filename: "executive_demo_2.html",
    },
    {
      id: "rp_5",
      orgId: "org_1",
      title: "ضمیمه فنی پیش‌بینی (دمو)",
      type: "technical",
      createdAt: seededAt,
      status: "ready",
      sections: ["forecast_charts"],
      filename: "technical_demo_2.html",
    },
  ];

  // Audit logs: at least 50
  const auditLogs: AuditLog[] = [];
  const auditActions = [
    { action: "dataset.upload", entity: "dataset" },
    { action: "dataset.validate", entity: "dataset" },
    { action: "dataset.publish", entity: "dataset" },
    { action: "scenario.run", entity: "scenario" },
    { action: "model.train", entity: "model" },
    { action: "forecast.run", entity: "forecast" },
    { action: "alert.trigger", entity: "alert" },
    { action: "user.create", entity: "user" },
    { action: "user.update", entity: "user" },
  ];
  for (let i = 0; i < 70; i++) {
    const u = users[i % users.length];
    const a = auditActions[i % auditActions.length];
    auditLogs.push({
      id: `aud_${i + 1}`,
      orgId: u.orgId,
      userId: u.id,
      userEmail: u.email,
      action: a.action,
      entity: a.entity,
      entityId:
        a.entity === "dataset"
          ? datasets[i % datasets.length].id
          : a.entity === "scenario"
            ? scenarios[i % scenarios.length].id
            : a.entity === "model"
              ? models[i % models.length].id
              : a.entity === "forecast"
                ? forecasts[i % forecasts.length].id
                : a.entity === "alert"
                  ? alerts[i % alerts.length].id
                  : a.entity === "user"
                    ? users[i % users.length].id
                    : undefined,
      createdAt: new Date(Date.now() - i * 1000 * 60 * 18).toISOString(),
      ip: "127.0.0.1",
      userAgent: "seed",
      payloadSnippet: "{\"demo\":true}",
    });
  }

  const jobs: Job[] = [];

  return {
    meta: { version: SEED_VERSION, seededAt },
    orgs,
    users,
    sessions: [],
    plains,
    aquifers,
    wells,
    wellTimeseries,
    wellNotes,
    datasets,
    datasetFiles,
    datasetValidations,
    scenarios,
    scenarioResults,
    models,
    modelMetrics,
    forecasts,
    forecastSeries,
    forecastWellResults,
    alerts,
    alertHistory,
    notifications,
    reports,
    auditLogs,
    jobs,
  };
}
