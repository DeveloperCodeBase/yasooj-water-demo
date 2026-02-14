import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=fa'],
});

function pickInfo(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    className: el.className ? String(el.className) : null,
    width: r.width,
    left: r.left,
    right: r.right,
    offsetWidth: el.offsetWidth,
    scrollWidth: el.scrollWidth,
    overflowX: cs.overflowX,
    display: cs.display,
  };
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/demo-autologin.html?as=viewer&next=/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60_000 }).catch(() => null);
  await page.waitForFunction(() => (document.body?.innerText || '').includes('داشبورد'), { timeout: 60_000 });

  // Wait for the heatmap title to exist.
  await page.waitForFunction(() => {
    const t = Array.from(document.querySelectorAll('div')).some((d) => (d.textContent || '').includes('ماتریس ریسک'));
    return t;
  }, { timeout: 60_000 });

  // Give layout time.
  await new Promise((r) => setTimeout(r, 1200));

  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docW = document.documentElement.scrollWidth;

    const titleEl = Array.from(document.querySelectorAll('div')).find((d) => (d.textContent || '').trim() === 'ماتریس ریسک (ماه x دشت)')
      || Array.from(document.querySelectorAll('div')).find((d) => (d.textContent || '').includes('ماتریس ریسک'));

    const card = titleEl ? titleEl.closest('.rounded-2xl') : null;
    const overflow = card ? card.querySelector('.overflow-auto') : null;
    const minw = overflow ? overflow.querySelector('[class*="min-w-"]') : null;

    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        className: el.className ? String(el.className) : null,
        width: r.width,
        left: r.left,
        right: r.right,
        offsetWidth: el.offsetWidth,
        scrollWidth: el.scrollWidth,
        overflowX: cs.overflowX,
        display: cs.display,
      };
    };

    return {
      vw,
      docW,
      card: pick(card),
      overflow: pick(overflow),
      inner: pick(minw),
    };
  });

  console.log(JSON.stringify(res, null, 2));
  await page.screenshot({ path: 'tmp/screens/dashboard-mobile-heatmap-fullpage.png', fullPage: true });
} finally {
  await browser.close();
}
