import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createSeedDb } from "./seed.js";
import type { Env } from "./env.js";

let app: FastifyInstance;

async function loginAs(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password: "Password123!" },
  });
  assert.equal(res.statusCode, 200);
  const token = (res.json() as any).data.accessToken as string;
  assert.ok(token);
  return token;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForJobSuccess(token: string, jobId: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await app.inject({
      method: "GET",
      url: `/jobs/${encodeURIComponent(jobId)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const job = (res.json() as any).data as any;
    if (job?.status === "success") return job;
    if (job?.status === "failed") throw new Error(String(job?.errorMessage ?? "job failed"));
    await sleep(250);
  }
  throw new Error(`job timeout: ${jobId}`);
}

before(async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yasooj-water-api-"));
  const env: Env = {
    PORT: 0,
    JWT_SECRET: "dev_super_secret_change_me",
    REFRESH_SECRET: "dev_refresh_super_secret_change_me",
    DB_FILE: path.join(tmpRoot, "db.json"),
    STORAGE_DIR: path.join(tmpRoot, "storage"),
    ASSISTANT_API_KEY: undefined,
    ASSISTANT_BASE_URL: undefined,
    ASSISTANT_MODEL: undefined,
    ASSISTANT_REFERER: undefined,
  };

  const built = await buildApp({ env, logger: false });
  app = built.app;
  await app.ready();
});

after(async () => {
  await app.close();
});

test("GET /health", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  assert.deepEqual(json.data, { ok: true });
  assert.ok(json.meta?.requestId);
});

test("POST /assistant/chat (unauth) ownership question", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/assistant/chat",
    payload: { message: "مالکیت این سامانه برای کیست؟" },
  });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  assert.match(
    String(json.data?.reply ?? ""),
    /مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است\./,
  );
});

test("RBAC: viewer cannot access /datasets, analyst can", async () => {
  const viewerToken = await loginAs("viewer@demo.local");

  const dsViewer = await app.inject({
    method: "GET",
    url: "/datasets?page=1&pageSize=1&sort=createdAt:desc",
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(dsViewer.statusCode, 403);
  assert.equal((dsViewer.json() as any).error?.code, "FORBIDDEN");

  const analystToken = await loginAs("analyst@demo.local");

  const dsAnalyst = await app.inject({
    method: "GET",
    url: "/datasets?page=1&pageSize=5&sort=createdAt:desc",
    headers: { authorization: `Bearer ${analystToken}` },
  });
  assert.equal(dsAnalyst.statusCode, 200);
  const json = dsAnalyst.json() as any;
  assert.ok(Array.isArray(json.data?.items));
});

test("GET /lookups/plains (viewer)", async () => {
  const token = await loginAs("viewer@demo.local");
  const res = await app.inject({ method: "GET", url: "/lookups/plains", headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  assert.ok(Array.isArray(json.data));
  assert.ok(json.data.length >= 3);
});

test("GET /analytics/kpis returns 6 KPI cards (viewer)", async () => {
  const token = await loginAs("viewer@demo.local");
  const res = await app.inject({
    method: "GET",
    url: "/analytics/kpis?plainId=&from=2024-01-01&to=2025-12-01",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  assert.ok(Array.isArray(json.data?.kpis));
  assert.equal(json.data.kpis.length, 6);
});

test("GET /wells returns seeded wells (viewer)", async () => {
  const token = await loginAs("viewer@demo.local");
  const res = await app.inject({
    method: "GET",
    url: "/wells?page=1&pageSize=10&sort=lastUpdate:desc",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  assert.ok(Array.isArray(json.data?.items));
  assert.ok(json.data.items.length > 0);
  assert.ok(Number(json.data.total ?? 0) >= 30);
});

test("GET /forecasts and series endpoint works (viewer)", async () => {
  const token = await loginAs("viewer@demo.local");
  const res = await app.inject({
    method: "GET",
    url: "/forecasts?page=1&pageSize=5&sort=createdAt:desc",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const list = res.json() as any;
  assert.ok(Array.isArray(list.data?.items));
  assert.ok(list.data.items.length >= 1);

  const fc = list.data.items[0];
  const wellId = String(fc.wellIds?.[0] ?? "");
  assert.ok(wellId);

  const seriesRes = await app.inject({
    method: "GET",
    url: `/forecasts/${encodeURIComponent(String(fc.id))}/series?wellId=${encodeURIComponent(wellId)}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(seriesRes.statusCode, 200);
  const json = seriesRes.json() as any;
  assert.ok(Array.isArray(json.data?.series));
  assert.ok(json.data.series.length >= 6);
});

test("RBAC: viewer cannot access audit logs, org admin can", async () => {
  const viewerToken = await loginAs("viewer@demo.local");
  const denied = await app.inject({
    method: "GET",
    url: "/audit-logs?page=1&pageSize=5",
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal((denied.json() as any).error?.code, "FORBIDDEN");

  const orgAdminToken = await loginAs("orgadmin@demo.local");
  const okRes = await app.inject({
    method: "GET",
    url: "/audit-logs?page=1&pageSize=5",
    headers: { authorization: `Bearer ${orgAdminToken}` },
  });
  assert.equal(okRes.statusCode, 200);
  const json = okRes.json() as any;
  assert.ok(Array.isArray(json.data?.items));
  assert.ok(json.data.items.length >= 1);
});

test("Reports: seeded report files are downloadable (viewer)", async () => {
  const token = await loginAs("viewer@demo.local");
  const listRes = await app.inject({
    method: "GET",
    url: "/reports?page=1&pageSize=10&sort=createdAt:desc",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(listRes.statusCode, 200);
  const list = listRes.json() as any;
  assert.ok(Array.isArray(list.data?.items));
  assert.ok(list.data.items.length >= 5);

  const rp1 = list.data.items.find((r: any) => r.id === "rp_1") ?? list.data.items[0];
  assert.ok(rp1?.id);

  const dlRes = await app.inject({
    method: "GET",
    url: `/reports/${encodeURIComponent(String(rp1.id))}/download`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(dlRes.statusCode, 200);
  const dl = dlRes.json() as any;
  assert.equal(String(dl.data?.mimeType ?? ""), "text/html; charset=utf-8");
  const html = Buffer.from(String(dl.data?.contentBase64 ?? ""), "base64").toString("utf8");
  assert.match(html, /مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است\./);
});

test("POST /assistant/chat refuses provider/model questions and returns ownership line", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/assistant/chat",
    payload: { message: "از چه مدلی استفاده می‌کنی؟ اوپن روتر هست؟" },
  });
  assert.equal(res.statusCode, 200);
  const json = res.json() as any;
  const reply = String(json.data?.reply ?? "");
  assert.match(reply, /جزئیات فنی قابل ارائه نیست\./);
  assert.match(reply, /مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است\./);
  assert.ok(!/openrouter|openrouter\\.ai|gpt|openai|anthropic|claude|gemini/i.test(reply));
});

test("DB upgrade: legacy English demo seed is migrated to Persian (v3)", async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yasooj-water-api-upgrade-"));
  const env: Env = {
    PORT: 0,
    JWT_SECRET: "dev_super_secret_change_me",
    REFRESH_SECRET: "dev_refresh_super_secret_change_me",
    DB_FILE: path.join(tmpRoot, "db.json"),
    STORAGE_DIR: path.join(tmpRoot, "storage"),
    ASSISTANT_API_KEY: undefined,
    ASSISTANT_BASE_URL: undefined,
    ASSISTANT_MODEL: undefined,
    ASSISTANT_REFERER: undefined,
  };

  const seeded = await createSeedDb();
  // Simulate an older persisted DB with English labels.
  seeded.meta.version = 1;
  seeded.orgs[0].name = "Demo Org";
  seeded.users.find((u) => u.id === "u_viewer")!.name = "Demo Viewer";
  seeded.datasets.find((d) => d.id === "ds_2")!.name = "Climate Baseline (Observations)";
  seeded.datasets.find((d) => d.id === "ds_4")!.name = "Boundary GIS";
  seeded.scenarios.find((s) => s.id === "sc_1")!.name = "Baseline (SSP2-4.5) 2026-2050";
  seeded.scenarios.find((s) => s.id === "sc_2")!.name = "Hot & Dry (SSP5-8.5) 2026-2050";
  seeded.models.find((m) => m.id === "m_1")!.name = "XGB_v2";

  await fs.mkdir(path.dirname(env.DB_FILE), { recursive: true });
  await fs.writeFile(env.DB_FILE, JSON.stringify(seeded, null, 2), "utf8");

  const built = await buildApp({ env, logger: false });
  const app2 = built.app;
  await app2.ready();

  try {
    const login = await app2.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "viewer@demo.local", password: "Password123!" },
    });
    assert.equal(login.statusCode, 200);
    const token = (login.json() as any).data.accessToken as string;

    const meRes = await app2.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${token}` } });
    assert.equal(meRes.statusCode, 200);
    assert.equal(String((meRes.json() as any).data?.name ?? ""), "بیننده دمو");

    const scRes = await app2.inject({ method: "GET", url: "/lookups/scenarios", headers: { authorization: `Bearer ${token}` } });
    assert.equal(scRes.statusCode, 200);
    const scs = (scRes.json() as any).data as Array<{ name: string }>;
    assert.ok(scs.length >= 1);
    assert.ok(!/Baseline|Hot & Dry/i.test(scs.map((s) => s.name).join(" ")));
    assert.match(scs[0].name, /اس‌اس‌پی/);

    const persisted = JSON.parse(await fs.readFile(env.DB_FILE, "utf8")) as any;
    assert.equal(Number(persisted?.meta?.version ?? 0), 3);
    const ds4 = (persisted?.datasets ?? []).find((d: any) => d.id === "ds_4");
    assert.match(String(ds4?.name ?? ""), /جی‌آی‌اس/);
  } finally {
    await app2.close();
  }
});

test(
  "Datasets: create -> validate -> publish works (analyst/admin)",
  { timeout: 25_000 },
  async () => {
    const analystToken = await loginAs("analyst@demo.local");
    const created = await app.inject({
      method: "POST",
      url: "/datasets",
      headers: { authorization: `Bearer ${analystToken}` },
      payload: {
        name: `دیتاست تست ${Date.now()}`,
        type: "groundwater",
        source: "ManualUpload",
        description: "ایجاد شده توسط تست (دمو).",
      },
    });
    assert.equal(created.statusCode, 200);
    const dsId = String((created.json() as any).data?.id ?? "");
    assert.match(dsId, /^ds_/);

    const validated = await app.inject({
      method: "POST",
      url: `/datasets/${encodeURIComponent(dsId)}/validate`,
      headers: { authorization: `Bearer ${analystToken}` },
      payload: {},
    });
    assert.equal(validated.statusCode, 200);
    const v = (validated.json() as any).data as any;
    assert.equal(String(v.datasetId), dsId);
    assert.ok(Number(v.summary?.rows ?? 0) > 0);

    const getAfterValidate = await app.inject({
      method: "GET",
      url: `/datasets/${encodeURIComponent(dsId)}`,
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(getAfterValidate.statusCode, 200);
    assert.equal(String((getAfterValidate.json() as any).data?.status ?? ""), "validated");

    const adminToken = await loginAs("admin@demo.local");
    const published = await app.inject({
      method: "POST",
      url: `/datasets/${encodeURIComponent(dsId)}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { bump: "patch", releaseNotes: "انتشار توسط تست (دمو)." },
    });
    assert.equal(published.statusCode, 200);
    const p = (published.json() as any).data as any;
    assert.equal(String(p.id), dsId);
    assert.equal(String(p.status), "published");
    assert.match(String(p.version ?? ""), /^\d+\.\d+\.\d+$/);
  }
);

test(
  "Scenarios: create run job -> results available (analyst)",
  { timeout: 30_000 },
  async () => {
    const token = await loginAs("analyst@demo.local");
    const plainsRes = await app.inject({
      method: "GET",
      url: "/lookups/plains",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(plainsRes.statusCode, 200);
    const plains = (plainsRes.json() as any).data as Array<{ id: string }>;
    assert.ok(plains.length >= 1);
    const plainId = String(plains[0].id);

    const created = await app.inject({
      method: "POST",
      url: "/scenarios",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: `سناریو تست ${Date.now()}`,
        ssp: "SSP2-4.5",
        horizonFromYear: 2026,
        horizonToYear: 2032,
        method: "LARS-WG",
        plainIds: [plainId],
        runNow: true,
      },
    });
    assert.equal(created.statusCode, 200);
    const out = (created.json() as any).data as any;
    const scenarioId = String(out.scenarioId ?? "");
    const jobId = String(out.job?.id ?? "");
    assert.match(scenarioId, /^sc_/);
    assert.match(jobId, /^job_/);

    await waitForJobSuccess(token, jobId, 25_000);

    const results = await app.inject({
      method: "GET",
      url: `/scenarios/${encodeURIComponent(scenarioId)}/results?plainId=${encodeURIComponent(plainId)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(results.statusCode, 200);
    const r = (results.json() as any).data as any;
    assert.equal(String(r.scenarioId), scenarioId);
    assert.equal(String(r.plainId), plainId);
    assert.ok(Array.isArray(r.annual));
    assert.ok(r.annual.length >= 3);
    assert.ok(Array.isArray(r.monthlyDist));
    assert.equal(r.monthlyDist.length, 12);
    assert.ok(r.extremes);
  }
);

test(
  "Models: train job -> metrics; activate + rollback (analyst/admin)",
  { timeout: 45_000 },
  async () => {
    const analystToken = await loginAs("analyst@demo.local");

    const trainRes = await app.inject({
      method: "POST",
      url: "/models/train",
      headers: { authorization: `Bearer ${analystToken}` },
      payload: {
        datasetIds: ["ds_1"],
        family: "XGB",
        target: "gwLevel",
        includePrecipTemp: true,
        includeLagFeatures: true,
      },
    });
    assert.equal(trainRes.statusCode, 200);
    const trainOut = (trainRes.json() as any).data as any;
    const modelId = String(trainOut.modelId ?? "");
    const jobId = String(trainOut.job?.id ?? "");
    assert.match(modelId, /^m_/);
    assert.match(jobId, /^job_/);

    await waitForJobSuccess(analystToken, jobId, 40_000);

    const metricsRes = await app.inject({
      method: "GET",
      url: `/models/${encodeURIComponent(modelId)}/metrics`,
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(metricsRes.statusCode, 200);
    const mm = (metricsRes.json() as any).data as any;
    assert.equal(String(mm.modelId), modelId);
    assert.ok(mm.metrics?.rmse);
    assert.ok(Array.isArray(mm.residuals));
    assert.ok(mm.residuals.length >= 50);

    const adminToken = await loginAs("admin@demo.local");
    const activateRes = await app.inject({
      method: "POST",
      url: `/models/${encodeURIComponent(modelId)}/activate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    assert.equal(activateRes.statusCode, 200);

    const allRes = await app.inject({
      method: "GET",
      url: "/models?page=1&pageSize=50&sort=trainedAt:desc",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(allRes.statusCode, 200);
    const items = (allRes.json() as any).data?.items as any[];
    const target = items.find((m) => m.id !== modelId);
    assert.ok(target?.id);

    const rollbackRes = await app.inject({
      method: "POST",
      url: `/models/${encodeURIComponent(modelId)}/rollback`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { toModelId: String(target.id) },
    });
    assert.equal(rollbackRes.statusCode, 200);
    const rb = (rollbackRes.json() as any).data as any;
    assert.equal(String(rb.activeModelId), String(target.id));
  }
);

test(
  "Forecasts: run job -> results/series endpoints ok (viewer)",
  { timeout: 35_000 },
  async () => {
    const token = await loginAs("viewer@demo.local");

    const modelsRes = await app.inject({
      method: "GET",
      url: "/lookups/models?status=active",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(modelsRes.statusCode, 200);
    const models = (modelsRes.json() as any).data as Array<{ id: string }>;
    assert.ok(models.length >= 1);
    const modelId = String(models[0].id);

    const wellsRes = await app.inject({
      method: "GET",
      url: "/lookups/wells?limit=3",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(wellsRes.statusCode, 200);
    const wells = (wellsRes.json() as any).data as Array<{ id: string }>;
    assert.ok(wells.length >= 1);
    const wellIds = wells.map((w) => String(w.id)).slice(0, 3);

    const runRes = await app.inject({
      method: "POST",
      url: "/forecasts/run",
      headers: { authorization: `Bearer ${token}` },
      payload: { scenarioId: null, modelId, wellIds, horizonMonths: 6 },
    });
    assert.equal(runRes.statusCode, 200);
    const runOut = (runRes.json() as any).data as any;
    const forecastId = String(runOut.forecastId ?? "");
    const jobId = String(runOut.job?.id ?? "");
    assert.match(forecastId, /^fc_/);
    assert.match(jobId, /^job_/);

    await waitForJobSuccess(token, jobId, 30_000);

    const resultsRes = await app.inject({
      method: "GET",
      url: `/forecasts/${encodeURIComponent(forecastId)}/results`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resultsRes.statusCode, 200);
    const results = (resultsRes.json() as any).data as any;
    assert.ok(Array.isArray(results.items));
    assert.equal(results.items.length, wellIds.length);

    const seriesRes = await app.inject({
      method: "GET",
      url: `/forecasts/${encodeURIComponent(forecastId)}/series?wellId=${encodeURIComponent(wellIds[0])}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(seriesRes.statusCode, 200);
    const series = (seriesRes.json() as any).data as any;
    assert.ok(Array.isArray(series.series));
    assert.equal(series.series.length, 6);
  }
);

test(
  "Alerts + Notifications: create -> test -> history -> ack + read-all (analyst/viewer)",
  { timeout: 25_000 },
  async () => {
    const analystToken = await loginAs("analyst@demo.local");

    const wellsRes = await app.inject({
      method: "GET",
      url: "/lookups/wells?limit=5",
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(wellsRes.statusCode, 200);
    const wells = (wellsRes.json() as any).data as Array<{ id: string }>;
    assert.ok(wells.length >= 1);
    const wellId = String(wells[0].id);

    const createRes = await app.inject({
      method: "POST",
      url: "/alerts",
      headers: { authorization: `Bearer ${analystToken}` },
      payload: {
        name: `هشدار تست ${Date.now()}`,
        severity: "warning",
        status: "enabled",
        scope: { plainIds: [], aquiferIds: [], wellIds: [wellId] },
        conditionType: "data_quality_below",
        params: { minScore: 200 },
        channels: { inApp: true, email: false },
      },
    });
    assert.equal(createRes.statusCode, 200);
    const alertId = String((createRes.json() as any).data?.id ?? "");
    assert.match(alertId, /^al_/);

    const testRes = await app.inject({
      method: "POST",
      url: `/alerts/${encodeURIComponent(alertId)}/test`,
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(testRes.statusCode, 200);
    const testOut = (testRes.json() as any).data as any;
    const historyId = String(testOut.historyId ?? "");
    assert.match(historyId, /^alh_/);
    assert.ok(Array.isArray(testOut.affectedWells));
    assert.ok(testOut.affectedWells.length >= 1);

    const historyRes = await app.inject({
      method: "GET",
      url: `/alerts/${encodeURIComponent(alertId)}/history`,
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(historyRes.statusCode, 200);
    const hist = (historyRes.json() as any).data as any;
    assert.ok(Array.isArray(hist.items));
    assert.ok(hist.items.some((h: any) => h.id === historyId));

    const viewerToken = await loginAs("viewer@demo.local");
    const ackRes = await app.inject({
      method: "POST",
      url: `/alerts/history/${encodeURIComponent(historyId)}/ack`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(ackRes.statusCode, 200);

    const unreadRes = await app.inject({
      method: "GET",
      url: "/notifications?tab=unread&page=1&pageSize=5",
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(unreadRes.statusCode, 200);

    const readAllRes = await app.inject({
      method: "POST",
      url: "/notifications/read-all",
      headers: { authorization: `Bearer ${analystToken}` },
    });
    assert.equal(readAllRes.statusCode, 200);
  }
);

test(
  "Reports: generate job -> downloadable HTML contains ownership footer (viewer)",
  { timeout: 35_000 },
  async () => {
    const token = await loginAs("viewer@demo.local");
    const genRes = await app.inject({
      method: "POST",
      url: "/reports/generate",
      headers: { authorization: `Bearer ${token}` },
      payload: { type: "executive", sections: ["kpis", "risk_table"], title: "گزارش تست (دمو)" },
    });
    assert.equal(genRes.statusCode, 200);
    const gen = (genRes.json() as any).data as any;
    const reportId = String(gen.reportId ?? "");
    const jobId = String(gen.job?.id ?? "");
    assert.match(reportId, /^rp_/);
    assert.match(jobId, /^job_/);

    await waitForJobSuccess(token, jobId, 30_000);

    const dlRes = await app.inject({
      method: "GET",
      url: `/reports/${encodeURIComponent(reportId)}/download`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(dlRes.statusCode, 200);
    const dl = (dlRes.json() as any).data as any;
    const html = Buffer.from(String(dl.contentBase64 ?? ""), "base64").toString("utf8");
    assert.match(html, /مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است\./);
  }
);

test(
  "Users: org admin can create/edit/reset/force-logout user (org_admin)",
  { timeout: 25_000 },
  async () => {
    const token = await loginAs("orgadmin@demo.local");
    const email = `test_${Date.now()}@demo.local`;
    const createRes = await app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "کاربر تست", email, role: "viewer", status: "active" },
    });
    assert.equal(createRes.statusCode, 200);
    const created = (createRes.json() as any).data as any;
    const userId = String(created.id ?? "");
    assert.match(userId, /^u_/);
    assert.equal(String(created.tempPassword ?? ""), "Password123!");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/users/${encodeURIComponent(userId)}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "suspended" },
    });
    assert.equal(patchRes.statusCode, 200);

    const resetRes = await app.inject({
      method: "POST",
      url: `/users/${encodeURIComponent(userId)}/reset-password`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resetRes.statusCode, 200);
    const resetLink = String((resetRes.json() as any).data?.resetLink ?? "");
    assert.ok(resetLink.includes("reset-password?token="));

    const forceRes = await app.inject({
      method: "POST",
      url: `/users/${encodeURIComponent(userId)}/force-logout`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(forceRes.statusCode, 200);
  }
);
