import fs from "node:fs/promises";
import path from "node:path";
import type { Env } from "./env.js";
import type { Dataset, DbData, Model, Org, Report, Scenario, User } from "./types.js";
import { createSeedDb } from "./seed.js";

// Keep in sync with apps/api/src/seed.ts
const CURRENT_SEED_VERSION = 3;

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function atomicWriteJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export class Db {
  private filePath: string;
  public data: DbData;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(filePath: string, data: DbData) {
    this.filePath = filePath;
    this.data = data;
  }

  static async init(env: Env): Promise<Db> {
    await ensureDir(env.STORAGE_DIR);
    await ensureDir(path.join(env.STORAGE_DIR, "uploads"));
    await ensureDir(path.join(env.STORAGE_DIR, "reports"));

    if (await fileExists(env.DB_FILE)) {
      const raw = await fs.readFile(env.DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as DbData;
      const db = new Db(env.DB_FILE, parsed);
      const upgraded = db.upgradeDemoSeedDataIfNeeded();
      if (upgraded) await db.persist();
      await db.ensureSeedReports(env, { force: upgraded });
      return db;
    }

    const seeded = await createSeedDb();
    const db = new Db(env.DB_FILE, seeded);
    await db.persist();
    await db.ensureSeedReports(env);
    return db;
  }

  async persist() {
    this.writeChain = this.writeChain.then(() => atomicWriteJson(this.filePath, this.data));
    return this.writeChain;
  }

  async mutate(fn: (data: DbData) => void | Promise<void>) {
    await fn(this.data);
    await this.persist();
  }

  private async ensureSeedReports(env: Env, opts?: { force?: boolean }) {
    const seedDir = path.resolve(process.cwd(), "seed/reports");
    if (!(await fileExists(seedDir))) return;

    for (const rp of this.data.reports) {
      const dst = path.join(env.STORAGE_DIR, "reports", rp.filename);
      const src = path.join(seedDir, rp.filename);
      if (!(await fileExists(src))) continue;
      const dstExists = await fileExists(dst);
      if (!dstExists || opts?.force) {
        await fs.copyFile(src, dst);
        continue;
      }

      // Keep seeded report files up-to-date (safe: only affects seeded filenames).
      try {
        const [srcBuf, dstBuf] = await Promise.all([fs.readFile(src), fs.readFile(dst)]);
        if (srcBuf.equals(dstBuf)) continue;
      } catch {
        // If we cannot read/compare, just keep the existing file.
        continue;
      }
      await fs.copyFile(src, dst);
    }
  }

  private upgradeDemoSeedDataIfNeeded(): boolean {
    const current = Number((this.data as any)?.meta?.version ?? 0);
    if (current >= CURRENT_SEED_VERSION) return false;

    const shouldOverwriteText = (v: unknown) => {
      if (typeof v !== "string") return true;
      const s = v.trim();
      if (!s) return true;
      // Old demo DB used English/ASCII placeholders (e.g. "Demo Viewer", "Baseline", "nhj").
      if (/[A-Za-z]/.test(s)) return true;
      return false;
    };

    let changed = false;

    const orgNameById: Record<string, string> = {
      org_1: "دمو سامانه تصمیم‌یار آب زیرزمینی یاسوج",
    };
    const userNameById: Record<string, string> = {
      u_viewer: "بیننده دمو",
      u_analyst: "تحلیلگر دمو",
      u_admin: "مدیر دمو",
      u_org_admin: "مدیر سازمان دمو",
      u_super_admin: "ابرمدیر دمو",
    };
    const datasetPatchById: Record<string, Pick<Dataset, "name" | "description">> = {
      ds_1: { name: "پایش آب زیرزمینی (۲۰۲۱ تا ۲۰۲۵)", description: "مشاهدات ماهانه سطح آب زیرزمینی برای ۳۰ چاه (دمو)." },
      ds_2: { name: "پایه اقلیم (مشاهدات)", description: "سری پایه بارش و دما (دمو)." },
      ds_3: { name: "مصرف آب (دمو)", description: "برآورد برداشت آب به تفکیک دشت (دمو)." },
      ds_4: { name: "مرزبندی جی‌آی‌اس (دشت‌ها/آبخوان‌ها)", description: "مرزهای ساده‌شده پلیگونی (دمو)." },
    };
    const scenarioNameById: Record<string, string> = {
      sc_1: "سناریوی مبنا (اس‌اس‌پی ۲-۴.۵) ۲۰۲۶ تا ۲۰۵۰",
      sc_2: "سناریوی گرم و خشک (اس‌اس‌پی ۵-۸.۵) ۲۰۲۶ تا ۲۰۵۰",
    };
    const modelPatchById: Record<string, Partial<Model>> = {
      m_1: { name: "ایکس‌جی‌بی نسخه ۲", metricsBadge: "RMSE ۱٫۸" },
      m_2: { name: "جنگل تصادفی نسخه ۱", metricsBadge: "RMSE ۲٫۲" },
      m_3: { name: "ال‌اس‌تی‌ام نسخه ۰" },
    };
    const reportTitleById: Record<string, string> = {
      rp_1: "گزارش مدیریتی ماهانه (دمو)",
      rp_2: "گزارش فنی مدل (دمو)",
      rp_3: "گزارش عملیات پایش (دمو)",
      rp_4: "خلاصه هفتگی مدیریتی (دمو)",
      rp_5: "ضمیمه فنی پیش‌بینی (دمو)",
    };

    for (const org of this.data.orgs ?? []) {
      const nextName = orgNameById[org.id];
      if (nextName && shouldOverwriteText(org.name)) {
        (org as Org).name = nextName;
        changed = true;
      }
      if (!org.settings?.logoUrl) {
        (org as Org).settings = { ...(org as Org).settings, logoUrl: "/logo.svg" } as any;
        changed = true;
      }
    }

    for (const u of this.data.users ?? []) {
      const nextName = userNameById[u.id];
      if (nextName && shouldOverwriteText(u.name)) {
        (u as User).name = nextName;
        changed = true;
      }
      if ((u as User).language !== "fa") {
        (u as User).language = "fa";
        changed = true;
      }
    }

    for (const ds of this.data.datasets ?? []) {
      const patch = datasetPatchById[ds.id];
      if (!patch) continue;
      if (shouldOverwriteText(ds.name)) {
        (ds as Dataset).name = patch.name;
        changed = true;
      }
      if (patch.description && shouldOverwriteText((ds as any).description)) {
        (ds as any).description = patch.description;
        changed = true;
      }
    }

    for (const sc of this.data.scenarios ?? []) {
      const nextName = scenarioNameById[sc.id];
      if (nextName && shouldOverwriteText(sc.name)) {
        (sc as Scenario).name = nextName;
        changed = true;
      }
    }

    for (const m of this.data.models ?? []) {
      const patch = modelPatchById[m.id];
      if (!patch) continue;
      if (patch.name && shouldOverwriteText(m.name)) {
        (m as Model).name = patch.name;
        changed = true;
      }
      if (patch.metricsBadge && shouldOverwriteText((m as any).metricsBadge)) {
        (m as any).metricsBadge = patch.metricsBadge;
        changed = true;
      }
    }

    for (const rp of this.data.reports ?? []) {
      const nextTitle = reportTitleById[rp.id];
      if (nextTitle && shouldOverwriteText(rp.title)) {
        (rp as Report).title = nextTitle;
        changed = true;
      }
    }

    // Bump version so we don't re-run the upgrade on the next boot.
    (this.data as any).meta = { ...(this.data as any).meta, version: CURRENT_SEED_VERSION };
    changed = true;

    return changed;
  }
}
