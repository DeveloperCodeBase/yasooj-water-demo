import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { ApiError, ok } from "../utils.js";

type ChatMsg = { role: "user" | "assistant"; content: string };

const OWNER = "مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی";

function ownershipLine() {
  return `مالکیت و حقوق این سامانه متعلق به ${OWNER} است.`;
}

function technicalRefusal() {
  return ["جزئیات فنی قابل ارائه نیست.", ownershipLine()].join("\n");
}

function normalizeForMatch(s: string) {
  return s.trim().toLowerCase();
}

function isOwnershipQuestion(message: string) {
  const m = normalizeForMatch(message);
  return /مالکیت|متعلق|صاحب|سازنده|کی ساخت|کی ساخته|کی ساختی|شرکت|owner|ownership|creator|created you|who (made|built|created) (you|this)/i.test(
    m,
  );
}

function isTechnicalMetaQuestion(message: string) {
  const m = normalizeForMatch(message);
  // Detect questions about the assistant's underlying implementation/provider.
  return /openrouter|open router|اوپن\s*روتر|جی\s*پی\s*تی|گپ\s*تی|gpt|openai|anthropic|claude|gemini|llm|large language model|what model are you|مدل\s*زبانی|چه\s*مدلی\s*هستی|زیرساخت|provider|پرووایدر|سرویس\s*پشت\s*صحنه/i.test(
    m,
  );
}

function systemPrompt() {
  return [
    "شما دستیار داخلی سامانه تصمیم‌یار آب زیرزمینی هستید.",
    "همیشه به فارسی پاسخ بده.",
    "فقط و فقط درباره همین پروژه/دمو پاسخ بده: صفحات، قابلیت‌ها و جریان‌های کاری (دیتاست‌ها، سناریوها، مدل‌ها، پیش‌بینی‌ها، هشدارها، اعلان‌ها، گزارش‌ها، مدیریت کاربران، لاگ ممیزی) و نحوه استفاده از آنها.",
    "اگر سوال خارج از این حوزه بود، مودبانه رد کن و کاربر را به سوالات مرتبط با همین پروژه هدایت کن.",
    `اگر کاربر درباره مالکیت/سازنده پرسید، دقیقاً همین جمله را بگو: ${ownershipLine()}`,
    "هرگز درباره مدل/ارائه‌دهنده/زیرساخت/سرویس‌های پشت‌صحنه صحبت نکن. اگر پرسیدند، بگو: «جزئیات فنی قابل ارائه نیست.» و سپس جمله مالکیت را تکرار کن.",
    "پاسخ‌ها را کوتاه، عملیاتی و مرحله‌به‌مرحله ارائه کن. در صورت نیاز، مسیر صفحه‌ها و نام منوها را ذکر کن.",
  ].join("\n");
}

function localAssistantFallback(message: string) {
  const m = normalizeForMatch(message);

  const helpFa: Record<string, string> = {
    dashboard: [
      "برای داشبورد:",
      "1) از منو «داشبورد» وارد شوید.",
      "2) از نوار فیلتر بالا «دشت/آبخوان/بازه زمانی/سناریو» را تنظیم و «اعمال» کنید.",
      "3) کارت‌های شاخص‌ها و نمودارها (روند سطح آب، اقلیم، باند عدم‌قطعیت، ماتریس ریسک) با داده‌های دمو نمایش داده می‌شوند.",
    ].join("\n"),
    wells: [
      "برای پایش چاه‌ها:",
      "1) منو «پایش چاه‌ها» را باز کنید.",
      "2) جستجو/فیلترها را اعمال کنید و روی ردیف کلیک کنید.",
      "3) در صفحه جزئیات، تب‌های «نمای کلی / سری زمانی / کیفیت / پیش‌بینی‌ها» را ببینید.",
    ].join("\n"),
    forecasts: [
      "برای پیش‌بینی‌ها:",
      "1) منو «پیش‌بینی‌ها» را باز کنید یا «اجرای پیش‌بینی» را از داشبورد بزنید.",
      "2) سناریو و مدل و چاه‌ها و افق را انتخاب کنید و «اجرا» را بزنید.",
      "3) در نتایج، نمودارهای عدم‌قطعیت (صدک‌های ۱۰/۵۰/۹۰) و جدول ریسک را مشاهده و خروجی سی‌اس‌وی/پی‌دی‌اف بگیرید.",
    ].join("\n"),
    datasets: [
      "برای دیتاست‌ها:",
      "1) منو «دیتاست‌ها» را باز کنید (تحلیلگر/مدیر).",
      "2) دیتاست بسازید، فایل آپلود کنید، «اعتبارسنجی» بزنید و سپس «انتشار» کنید.",
      "3) گزارش کیفیت و خطاها در همان صفحه نمایش داده می‌شود.",
    ].join("\n"),
    scenarios: [
      "برای سناریوهای اقلیمی:",
      "1) منو «سناریوهای اقلیمی» -> «ایجاد سناریو».",
      "2) SSP، افق زمانی، روش و محدوده را انتخاب کنید و «اجرا» را بزنید.",
      "3) در صفحه نتایج، نمودارهای دما/بارش و دانلودها را ببینید.",
    ].join("\n"),
    models: [
      "برای مدل‌ها:",
      "1) منو «مدل‌ها» را باز کنید.",
      "2) «آموزش مدل» را اجرا کنید و وضعیت کار و متریک‌ها را ببینید.",
      "3) در جزئیات مدل، متریک‌ها و نمودار باقیمانده‌ها/اهمیت ویژگی‌ها و کنترل‌های فعال‌سازی/بازگشت نسخه موجود است.",
    ].join("\n"),
    alerts: [
      "برای هشدارها:",
      "1) منو «هشدارها» -> «ساخت هشدار».",
      "2) محدوده، شرط، شدت و کانال اعلان را تنظیم کنید و ذخیره کنید.",
      "3) از لیست هشدارها می‌توانید «تست»، «غیرفعال‌سازی» و تاریخچه فعال‌شدن را ببینید.",
    ].join("\n"),
    notifications: [
      "برای اعلان‌ها:",
      "1) منو «اعلان‌ها» را باز کنید.",
      "2) بین تب «همه/خوانده‌نشده» جابجا شوید و «خوانده شد» را انجام دهید.",
    ].join("\n"),
    reports: [
      "برای گزارش‌ها:",
      "1) منو «گزارش‌ها» -> «ایجاد گزارش».",
      "2) نوع گزارش و بخش‌ها را انتخاب کنید و «تولید گزارش» را بزنید.",
      "3) فایل‌های نمونه (دمو) در لیست گزارش‌ها قابل دانلود هستند.",
    ].join("\n"),
    users: [
      "برای مدیریت کاربران (مدیر سازمان/ابرمدیر):",
      "1) منو «مدیریت کاربران» را باز کنید.",
      "2) ساخت/ویرایش کاربر، تغییر نقش/وضعیت و «خروج اجباری» در دسترس است.",
    ].join("\n"),
    audit: [
      "برای لاگ ممیزی:",
      "1) منو «لاگ ممیزی» را باز کنید (مدیر سازمان به بالا).",
      "2) فیلتر کاربر/عملیات/موجودیت و بازه زمانی را اعمال کنید.",
      "3) روی ردیف کلیک کنید تا جزئیات (IP، مرورگر/دستگاه، خلاصه داده) را ببینید.",
    ].join("\n"),
    settings: [
      "برای تنظیمات:",
      "1) «تنظیمات پروفایل» برای نام/رمز/پوسته.",
      "2) «تنظیمات سازمان» (مدیر سازمان) برای نام سازمان، لوگو، واحدها و ناحیه زمانی.",
    ].join("\n"),
  };

  const topicRules: Array<{ key: string; re: RegExp }> = [
    { key: "dashboard", re: /(dashboard|داشبورد)/i },
    { key: "wells", re: /(well|wells|چاه|پایش)/i },
    { key: "forecasts", re: /(forecast|پیش‌بینی|پيشبيني)/i },
    { key: "datasets", re: /(dataset|دیتاست|داده)/i },
    { key: "scenarios", re: /(scenario|سناریو|اقلیم|اقليمي|ssp)/i },
    { key: "models", re: /(model registry|train model|models|مدل)/i },
    { key: "alerts", re: /(alert|هشدار)/i },
    { key: "notifications", re: /(notification|اعلان)/i },
    { key: "reports", re: /(report|گزارش)/i },
    { key: "users", re: /(user management|users|کاربر)/i },
    { key: "audit", re: /(audit|ممیزی|ممیزی|لاگ)/i },
    { key: "settings", re: /(settings|تنظیمات|پروفایل|سازمان)/i },
  ];

  const picked = topicRules.find((r) => r.re.test(m))?.key ?? null;
  if (picked) return helpFa[picked];

  // If the message is clearly unrelated, refuse and guide.
  if (/(capital of|weather|bitcoin|stock|recipe|movie|song|translate|کاپیتال|هواشناسی|بورس|بیتکوین|آشپزی|فیلم|ترجمه)/i.test(m)) {
    return "من فقط درباره همین دمو سامانه تصمیم‌یار آب زیرزمینی پاسخ می‌دهم. لطفا درباره داشبورد، پایش چاه‌ها، دیتاست‌ها، سناریوها، مدل‌ها، پیش‌بینی‌ها، هشدارها، اعلان‌ها، گزارش‌ها یا مدیریت کاربران سوال بپرسید.";
  }

  return "می‌تونم درباره صفحات و قابلیت‌های همین دمو کمک کنم. مثلا بپرسید: «چطور پیش‌بینی اجرا کنم؟»، «چطور هشدار بسازم؟»، «چطور دیتاست را اعتبارسنجی و منتشر کنم؟»";
}

function containsBannedDisclosure(text: string) {
  // Do NOT ban generic words like "model" because the project includes "Models" domain.
  return /openrouter|openrouter\.ai|openai|anthropic|claude|gemini|gpt[\w\-]*|large language model|\bllm\b/i.test(text);
}

async function callAssistant(env: Env, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const apiKey = env.ASSISTANT_API_KEY;
  if (!apiKey) return null;

  const base = env.ASSISTANT_BASE_URL || "https://openrouter.ai/api/v1";
  const model = env.ASSISTANT_MODEL || "openai/gpt-4o-mini";

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // Recommended by OpenRouter; safe to include even if unused.
      "HTTP-Referer": env.ASSISTANT_REFERER || "http://localhost",
      "X-Title": "Yasooj Water DSS Demo",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 650,
    }),
  });

  const json = (await resp.json().catch(() => null)) as any;
  if (!resp.ok) {
    // Do not leak upstream details to the UI.
    throw new ApiError({ code: "ASSISTANT_ERROR", message: "خطا در سرویس دستیار", statusCode: 502 });
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return null;
  return content.trim();
}

export function assistantRoutes(db: Db, env: Env): FastifyPluginAsync {
  return async function (app) {
    app.post("/assistant/chat", async (request, reply) => {
      // Optional auth: if the client is logged in, verify JWT; otherwise keep it usable on landing/login pages.
      try {
        const authz = String((request.headers as any)?.authorization ?? "");
        if (authz) await (request as any).jwtVerify();
      } catch {
        // ignore
      }

      const body = z
        .object({
          message: z.string().min(1).max(3000),
          history: z
            .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(3000) }))
            .max(20)
            .optional(),
        })
        .safeParse(request.body);
      if (!body.success) {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      }

      // Hard rules (always enforced locally).
      if (isOwnershipQuestion(body.data.message)) {
        return ok(reply, request, { reply: ownershipLine() });
      }
      if (isTechnicalMetaQuestion(body.data.message)) {
        return ok(reply, request, { reply: technicalRefusal() });
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt() },
      ];
      for (const m of body.data.history ?? []) {
        messages.push({ role: m.role, content: m.content });
      }
      messages.push({ role: "user", content: body.data.message });

      // If not configured, keep it working for demo runs.
      if (!env.ASSISTANT_API_KEY) {
        return ok(reply, request, { reply: localAssistantFallback(body.data.message) });
      }

      let content: string | null = null;
      try {
        content = await callAssistant(env, messages);
      } catch {
        // Always keep the demo assistant usable even if the upstream service is unavailable.
        content = null;
      }
      const safeText = content && containsBannedDisclosure(content) ? technicalRefusal() : content;
      const replyText = safeText ?? localAssistantFallback(body.data.message);

      return ok(reply, request, { reply: replyText });
    });
  };
}
