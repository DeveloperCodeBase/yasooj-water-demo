export type Role = "viewer" | "analyst" | "admin" | "org_admin" | "super_admin";

export type UserStatus = "active" | "suspended" | "locked";

export type DatasetType = "climate" | "groundwater" | "usage" | "gis";
export type DatasetStatus = "draft" | "validated" | "published";

export type ScenarioSsp = "SSP1-2.6" | "SSP2-4.5" | "SSP3-7.0" | "SSP5-8.5";
export type ScenarioMethod = "LARS-WG" | "BiasCorrection";
export type ScenarioStatus = "draft" | "running" | "ready" | "failed";

export type ModelFamily = "RF" | "XGB" | "LSTM";
export type ModelStatus = "draft" | "active" | "archived";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "enabled" | "disabled";
export type AlertConditionType =
  | "gw_level_below"
  | "drop_rate_above"
  | "prob_cross_threshold_above"
  | "data_quality_below";

export type NotificationSeverity = "info" | "warning" | "critical";

export type ReportType = "executive" | "technical" | "ops";

export type JobStatus = "queued" | "running" | "success" | "failed";
export type JobStepStatus = "queued" | "running" | "success" | "failed";

export type Id = string;

export type Org = {
  id: Id;
  name: string;
  createdAt: string;
  settings: {
    units: { gwLevel: "m"; precip: "mm"; temp: "C" };
    timezone: string;
    logoUrl?: string;
  };
};

export type User = {
  id: Id;
  orgId: Id;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  language: "fa" | "en";
  theme: "light" | "dark";
  createdAt: string;
  lastLoginAt?: string;
};

export type Plain = {
  id: Id;
  province?: string;
  nameFa: string;
  nameEn: string;
};

export type Aquifer = {
  id: Id;
  plainId: Id;
  nameFa: string;
  nameEn: string;
};

export type Well = {
  id: Id;
  code: string;
  name: string;
  plainId: Id;
  aquiferId: Id;
  status: "active" | "inactive";
  tags?: string[];
  depthM: number;
  lat: number;
  lon: number;
  monitoringFrequency: "daily" | "weekly" | "monthly";
  latestGwLevelM: number | null;
  change30dM: number | null;
  dataQualityScore: number; // 0-100
  riskScore: number; // 0-1
  riskLevel: RiskLevel;
  lastUpdate: string; // ISO
  createdAt: string;
  pinned?: boolean;
};

export type WellTimeseriesPoint = {
  id: Id;
  wellId: Id;
  date: string; // ISO (month start)
  gwLevelM: number | null;
  precipMm: number;
  tmeanC: number;
  flags: {
    anomaly?: boolean;
    missing?: boolean;
  };
};

export type WellNote = {
  id: Id;
  wellId: Id;
  authorUserId: Id;
  body: string;
  createdAt: string;
};

export type Dataset = {
  id: Id;
  orgId: Id;
  name: string;
  type: DatasetType;
  source: "ManualUpload" | "API" | "Other";
  description?: string;
  version: string;
  status: DatasetStatus;
  releaseNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DatasetFile = {
  id: Id;
  datasetId: Id;
  filename: string;
  sizeBytes: number;
  status: "uploaded" | "validated";
  uploadedAt: string;
};

export type DatasetValidation = {
  id: Id;
  datasetId: Id;
  validatedAt: string;
  summary: {
    rows: number;
    columns: number;
    missingPct: number;
    invalidDatePct: number;
    duplicates: number;
  };
  errors: Array<{
    column: string;
    errorType: string;
    rowIndex: number;
    message: string;
  }>;
  completenessByColumn: Array<{ column: string; completeness: number }>;
};

export type Scenario = {
  id: Id;
  orgId: Id;
  name: string;
  ssp: ScenarioSsp;
  horizonFromYear: number;
  horizonToYear: number;
  method: ScenarioMethod;
  plainIds: Id[];
  status: ScenarioStatus;
  lastRunAt?: string;
  createdAt: string;
};

export type ScenarioResults = {
  id: Id;
  scenarioId: Id;
  plainId: Id;
  annual: Array<{ year: number; tmean: number; precip: number }>;
  monthlyDist: Array<{ month: number; tmean: number; precip: number }>;
  extremes: { max1DayPrecip: number; heatDays: number };
};

export type Model = {
  id: Id;
  orgId: Id;
  name: string;
  family: ModelFamily;
  version: string;
  status: ModelStatus;
  trainedAt?: string;
  createdAt: string;
  metricsBadge?: string;
};

export type ModelMetrics = {
  id: Id;
  modelId: Id;
  metrics: { rmse: number; mae: number; r2: number; nse: number };
  residuals: Array<{ actual: number; pred: number; res: number }>;
  featureImportance: Array<{ feature: string; importance: number }>;
};

export type Forecast = {
  id: Id;
  orgId: Id;
  scenarioId: Id | null;
  modelId: Id;
  wellIds: Id[];
  horizonMonths: number;
  status: "running" | "ready" | "failed";
  createdAt: string;
  createdByUserId: Id;
  confidence: "high" | "medium" | "low";
};

export type ForecastSeriesPoint = {
  id: Id;
  forecastId: Id;
  wellId: Id;
  date: string;
  p10: number;
  p50: number;
  p90: number;
};

export type ForecastWellResult = {
  forecastId: Id;
  wellId: Id;
  wellCode: string;
  p50FinalLevel: number;
  probCrossThreshold: number;
  expectedDropRate: number;
  riskLevel: RiskLevel;
};

export type Alert = {
  id: Id;
  orgId: Id;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  scope: {
    plainIds: Id[];
    aquiferIds: Id[];
    wellIds: Id[];
  };
  conditionType: AlertConditionType;
  params: Record<string, unknown>;
  channels: { inApp: boolean; email: boolean };
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AlertHistoryItem = {
  id: Id;
  alertId: Id;
  triggeredAt: string;
  wellsAffected: Id[];
  summary: string;
  acknowledgedAt?: string;
  acknowledgedByUserId?: Id;
};

export type Notification = {
  id: Id;
  orgId: Id;
  userId: Id;
  title: string;
  body: string;
  severity: NotificationSeverity;
  createdAt: string;
  readAt?: string;
  related?: { entity: string; entityId: string };
};

export type Report = {
  id: Id;
  orgId: Id;
  title: string;
  type: ReportType;
  createdAt: string;
  status: "ready" | "generating" | "failed";
  sections: string[];
  // Stored on disk in STORAGE_DIR/reports/<filename>
  filename: string;
};

export type AuditLog = {
  id: Id;
  orgId: Id;
  userId: Id;
  userEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
  ip?: string;
  userAgent?: string;
  payloadSnippet?: string;
};

export type Session = {
  id: Id;
  orgId: Id;
  userId: Id;
  refreshToken: string;
  createdAt: string;
  revokedAt?: string;
  ip?: string;
  userAgent?: string;
};

export type Job = {
  id: Id;
  orgId: Id;
  type: "scenario_run" | "model_train" | "forecast_run" | "report_generate";
  status: JobStatus;
  progress: number; // 0-100
  steps: Array<{ name: string; status: JobStepStatus }>;
  logs: string[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: Record<string, unknown>;
  errorMessage?: string;
};

export type DbData = {
  meta: { version: number; seededAt: string };
  orgs: Org[];
  users: User[];
  sessions: Session[];
  plains: Plain[];
  aquifers: Aquifer[];
  wells: Well[];
  wellTimeseries: WellTimeseriesPoint[];
  wellNotes: WellNote[];
  datasets: Dataset[];
  datasetFiles: DatasetFile[];
  datasetValidations: DatasetValidation[];
  scenarios: Scenario[];
  scenarioResults: ScenarioResults[];
  models: Model[];
  modelMetrics: ModelMetrics[];
  forecasts: Forecast[];
  forecastSeries: ForecastSeriesPoint[];
  forecastWellResults: ForecastWellResult[];
  alerts: Alert[];
  alertHistory: AlertHistoryItem[];
  notifications: Notification[];
  reports: Report[];
  auditLogs: AuditLog[];
  jobs: Job[];
};
