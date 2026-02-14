import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=fa'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const url = `${BASE}/demo-autologin.html?as=viewer&next=/dashboard`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60_000 }).catch(() => null);
  await page.waitForFunction(() => (document.body?.innerText || '').includes('داشبورد'), { timeout: 60_000 });

  // give ResizeObserver a moment
  await new Promise((r) => setTimeout(r, 1200));

  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docW = document.documentElement.scrollWidth;

    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        className: el.className ? String(el.className) : null,
        widthRect: r.width,
        left: r.left,
        right: r.right,
        offsetWidth: el.offsetWidth,
        scrollWidth: el.scrollWidth,
        styleWidth: cs.width,
        display: cs.display,
        position: cs.position,
        overflowX: cs.overflowX,
      };
    };

    const chart = document.querySelector('.recharts-responsive-container');
    const svg = chart ? chart.querySelector('svg') : null;
    const card = chart ? chart.closest('.rounded-2xl') : null;

    const chain = [];
    let cur = chart;
    for (let i = 0; i < 8 && cur; i++) {
      chain.push(pick(cur));
      cur = cur.parentElement;
    }

    return {
      vw,
      docW,
      chart: pick(chart),
      svg: pick(svg),
      card: pick(card),
      chain,
    };
  });

  console.log(JSON.stringify(res, null, 2));
  await page.screenshot({ path: 'tmp/screens/dashboard-mobile-debug-widths.png', fullPage: true });
} finally {
  await browser.close();
}
