import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

function clipStr(s, n = 140) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--font-render-hinting=none',
    '--lang=fa',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  const url = `${BASE}/demo-autologin.html?as=viewer&next=/dashboard`;
  console.log('goto', url);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60_000 }).catch(() => null);

  // Wait for dashboard title.
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || '';
      return t.includes('داشبورد');
    },
    { timeout: 60_000 }
  );

  const diag = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const bw = document.body ? document.body.scrollWidth : 0;

    const offenders = [];
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const right = r.right;
      const left = r.left;
      if (!Number.isFinite(w) || w <= vw + 0.5) continue;

      const cs = window.getComputedStyle(el);
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className ? String(el.className) : null,
        width: w,
        left,
        right,
        display: cs.display,
        position: cs.position,
        overflowX: cs.overflowX,
      });
      if (offenders.length >= 30) break;
    }

    return {
      ua: navigator.userAgent,
      viewport: { vw, vh: document.documentElement.clientHeight },
      scroll: { doc: sw, body: bw, x: window.scrollX, y: window.scrollY },
      offenders,
    };
  });

  console.log('diag:', JSON.stringify(diag, null, 2));

  // Also dump a couple of key layout boxes.
  const boxes = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { sel, left: r.left, right: r.right, width: r.width };
    };
    return {
      root: pick('#root'),
      main: pick('main'),
      page: pick('[data-page]'),
    };
  });
  console.log('boxes:', JSON.stringify(boxes, null, 2));

  await page.screenshot({ path: 'tmp/screens/dashboard-mobile-puppeteer.png', fullPage: false });
  console.log('saved screenshot tmp/screens/dashboard-mobile-puppeteer.png');

  // Dump a snippet of visible text to ensure content is actually there.
  const textSnippet = await page.evaluate(() => (document.body?.innerText || '').slice(0, 800));
  console.log('text:', clipStr(textSnippet, 800));

} finally {
  await browser.close();
}
