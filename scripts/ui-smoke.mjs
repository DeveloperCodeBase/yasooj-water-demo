import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT_DIR = process.env.OUT_DIR || "tmp/screens/ui-smoke";
const SCREENSHOTS = (process.env.SCREENSHOTS || "fail").toLowerCase(); // fail|all|none

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2 },
  { name: "desktop", width: 1365, height: 768, deviceScaleFactor: 1 },
];

const CASES = [
  // Viewer
  { role: "viewer", path: "/dashboard" },
  { role: "viewer", path: "/wells" },
  { role: "viewer", path: "/wells/well_yas_001" },
  { role: "viewer", path: "/forecasts" },
  { role: "viewer", path: "/forecasts/run" },
  { role: "viewer", path: "/forecasts/fc_1" },
  { role: "viewer", path: "/notifications" },
  { role: "viewer", path: "/reports" },
  { role: "viewer", path: "/reports/new" },
  { role: "viewer", path: "/settings/profile" },

  // Analyst
  { role: "analyst", path: "/datasets" },
  { role: "analyst", path: "/datasets/ds_1" },
  { role: "analyst", path: "/scenarios" },
  { role: "analyst", path: "/scenarios/new" },
  { role: "analyst", path: "/scenarios/sc_1" },
  { role: "analyst", path: "/models" },
  { role: "analyst", path: "/models/train" },
  { role: "analyst", path: "/models/m_1" },
  { role: "analyst", path: "/alerts" },
  { role: "analyst", path: "/alerts/new" },
  { role: "analyst", path: "/alerts/al_1" },
  { role: "analyst", path: "/alerts/al_1/history" },

  // Org admin
  { role: "org_admin", path: "/users" },
  { role: "org_admin", path: "/users/u_viewer" },
  { role: "org_admin", path: "/users/new" },
  { role: "org_admin", path: "/settings/org" },
  { role: "org_admin", path: "/audit-logs" },

  // Super admin
  { role: "super_admin", path: "/orgs" },
];

function slugify(s) {
  return String(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function waitForPathname(page, pathname, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const u = new URL(page.url());
      if (u.pathname === pathname) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout waiting for navigation to ${pathname} (current: ${page.url()})`);
}

async function gotoAutologin(page, role, nextPath) {
  const u = new URL(`${BASE}/demo-autologin.html`);
  u.searchParams.set("as", role);
  u.searchParams.set("next", nextPath);
  await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForPathname(page, nextPath, 90_000);
  // Allow data-fetch + layout to settle.
  await new Promise((r) => setTimeout(r, 900));
}

async function checkLayout(page, { checkSidebar }) {
  return await page.evaluate(({ checkSidebar }) => {
    const html = document.documentElement;
    const dir = html.getAttribute("dir") || "";
    const lang = html.getAttribute("lang") || "";
    const vw = document.documentElement.clientWidth;
    const docW = document.documentElement.scrollWidth;

    const res = { dir, lang, vw, docW, overflowX: docW > vw + 1 };

    if (checkSidebar) {
      const aside = document.querySelector("aside");
      if (!aside) {
        return { ...res, sidebar: null };
      }
      const r = aside.getBoundingClientRect();
      return {
        ...res,
        sidebar: {
          left: r.left,
          right: r.right,
          width: r.width,
          // Sidebar should be docked to the right edge.
          dockedRight: Math.abs(r.right - window.innerWidth) <= 2,
        },
      };
    }

    return res;
  }, { checkSidebar });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--lang=fa"],
});

const results = [];
let failed = 0;

try {
  await ensureDir(OUT_DIR);

  for (const vp of VIEWPORTS) {
    for (const tc of CASES) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor });
      const name = `${vp.name}_${tc.role}_${slugify(tc.path)}`;

      let ok = true;
      let info = null;
      try {
        await gotoAutologin(page, tc.role, tc.path);
        info = await checkLayout(page, { checkSidebar: vp.name === "desktop" });

        if (info.dir !== "rtl" || info.lang !== "fa") ok = false;
        if (info.overflowX) ok = false;
        if (vp.name === "desktop" && info.sidebar && !info.sidebar.dockedRight) ok = false;
      } catch (e) {
        ok = false;
        info = { error: String(e?.message ?? e) };
      }

      if (!ok) failed += 1;
      results.push({ name, ok, info });

      const shouldShot =
        SCREENSHOTS === "all" ||
        (SCREENSHOTS === "fail" && !ok);
      if (shouldShot) {
        const out = path.join(OUT_DIR, `${name}.png`);
        try {
          await page.screenshot({ path: out, fullPage: true });
        } catch (e) {
          // Screenshot failures shouldn't fail the whole smoke-run.
          results[results.length - 1] = {
            ...results[results.length - 1],
            info: { ...(results[results.length - 1]?.info ?? {}), screenshotError: String(e?.message ?? e) },
          };
        }
      }

      await page.close();
    }
  }
} finally {
  await browser.close();
}

// Print a compact summary for CI/local runs.
const summary = {
  baseUrl: BASE,
  outDir: OUT_DIR,
  screenshots: SCREENSHOTS,
  total: results.length,
  failed,
  items: results,
};
console.log(JSON.stringify(summary, null, 2));

if (failed) process.exitCode = 1;
