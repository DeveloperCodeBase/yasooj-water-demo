import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { motion } from "framer-motion";
import { Badge, Button, Card, CardBody } from "../components/ui";
import { cn } from "../lib/cn";
import { Activity, Bell, ChartLine, Database, Droplets, FileText, Moon, Shield, Sun } from "lucide-react";

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-border bg-card/70 grid place-items-center">{icon}</div>
        <div className="min-w-0 text-right">
          <div className="text-[13px] font-semibold truncate">{title}</div>
          <div className="mt-1 text-[12px] text-muted leading-snug">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-2xl border border-border bg-card/70 grid place-items-center">{icon}</div>
        <div className="min-w-0 text-right">
          <div className="text-[18px] font-semibold leading-none">{value}</div>
          <div className="mt-1 text-[12px] text-muted">{label}</div>
          <div className="mt-2 text-[11px] text-muted/80">{hint}</div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const auth = useAuth();
  const nav = useNavigate();

  React.useEffect(() => {
    if (auth.ready && auth.user) nav("/dashboard", { replace: true });
  }, [auth.ready, auth.user, nav]);

  return (
    <div className="min-h-full font-fa">
      <div className="relative overflow-hidden">
        <div
          className={cn(
            "pointer-events-none absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full blur-3xl",
            "bg-primary/15"
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute -bottom-24 -left-24 h-[520px] w-[520px] rounded-full blur-3xl",
            "bg-primary-2/15"
          )}
        />

        <header className="px-4 pt-8 md:px-6">
          <div className="mx-auto w-full max-w-[1100px] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl border border-border bg-card/70 grid place-items-center overflow-hidden shadow-soft-md shrink-0">
                <img src="/logo.svg" alt="لوگو" className="h-9 w-9 object-contain" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-[14px] font-semibold truncate">سامانه تصمیم‌یار آب زیرزمینی</div>
                <div className="text-[12px] text-muted truncate">
                  پایش چاه‌ها، پیش‌بینی، سناریوهای اقلیمی، هشدار و گزارش‌ساز (دمو)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => nav("/login")}>
                ورود
              </Button>
              <button
                className="rounded-xl border border-border px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition"
                onClick={() => void auth.setTheme(auth.theme === "dark" ? "light" : "dark")}
                type="button"
                aria-label="پوسته"
                title="پوسته"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="hidden sm:inline">{auth.theme === "dark" ? "پوسته روشن" : "پوسته تیره"}</span>
                  {auth.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-10 md:px-6">
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="mt-8 grid gap-6 lg:grid-cols-2 items-start">
              <motion.div
                className="text-right"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35 }}
              >
                <h1 className="text-[30px] md:text-[38px] font-semibold leading-tight">
                  دمو حرفه‌ای سامانه تصمیم‌یار آب زیرزمینی برای پایش، پیش‌بینی و هشدار
                </h1>
                <p className="mt-3 text-[14px] text-muted leading-relaxed">
                  این دمو کل جریان‌های اصلی را با داده‌های واقعی‌نما اجرا می‌کند: پایش چاه‌ها، پیش‌بینی با باند عدم‌قطعیت (صدک‌های ۱۰/۵۰/۹۰)،
                  سناریوهای اقلیمی، هشدارها و اعلان‌ها، گزارش‌ساز و مدیریت کاربران همراه با لاگ ممیزی.
                </p>

                <div className="mt-5 flex items-center gap-2 flex-wrap">
                  <Button variant="primary" onClick={() => nav("/login")}>
                    ورود به سامانه
                  </Button>
                  <a href="/api/docs" target="_blank" rel="noreferrer">
                    <Button>مستندات سرویس</Button>
                  </a>
                  <Badge tone="info">راست‌به‌چپ</Badge>
                  <Badge tone="info">تقویم شمسی</Badge>
                  <Badge tone="success">داده دمو</Badge>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Stat icon={<Droplets size={18} />} value="۳۰" label="چاه پایش‌شده" hint="۳ دشت، ۶ آبخوان (داده دمو)" />
                  <Stat icon={<ChartLine size={18} />} value="۶۰" label="نقطه ماهانه برای هر چاه" hint="۵ سال داده ماهانه (۲۰۲۱ تا ۲۰۲۵)" />
                  <Stat icon={<Activity size={18} />} value="صدک ۱۰/۵۰/۹۰" label="عدم‌قطعیت پیش‌بینی" hint="همراه با رتبه‌بندی ریسک" />
                  <Stat icon={<Shield size={18} />} value="۷۰+" label="رویداد ممیزی" hint="ثبت عملیات‌های کلیدی برای دمو" />
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
                  <div className="text-[13px] font-semibold">شروع سریع</div>
                  <ol className="mt-3 grid gap-2 text-[12px] text-muted">
                    <li>1) وارد شوید و از منو «داشبورد» وضعیت کلی را ببینید.</li>
                    <li>2) در «پیش‌بینی‌ها» یک سناریو و مدل انتخاب کنید و پیش‌بینی اجرا کنید.</li>
                    <li>3) در «هشدارها» یک قانون بسازید و تاریخچه فعال‌شدن را بررسی کنید.</li>
                    <li>4) از «گزارش‌ها» خروجی مدیریتی/فنی تولید و دانلود کنید.</li>
                  </ol>

                  <div className="mt-4 text-[12px] text-muted leading-relaxed">
                    برای ورود از یکی از حساب‌های دمو استفاده کنید. رمز همه کاربران:{" "}
                    <span className="font-mono">Password123!</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[12px]">
                    {["viewer@demo.local", "analyst@demo.local", "admin@demo.local", "orgadmin@demo.local", "superadmin@demo.local"].map((e) => (
                      <span key={e} className="rounded-full border border-border bg-card/60 px-3 py-1">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="space-y-4"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-right">
                        <div className="text-[14px] font-semibold">امکانات کلیدی</div>
                    <div className="mt-1 text-[12px] text-muted">
                          همه بخش‌ها با سرویس واقعی و داده دمو قابل استفاده هستند.
                    </div>
                      </div>
                      <div className="h-10 w-10 rounded-2xl border border-border bg-card/70 grid place-items-center">
                        <FileText size={18} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Feature icon={<Droplets size={18} />} title="پایش چاه‌ها" desc="لیست، فیلتر، جزئیات و نمودارهای سری زمانی" />
                      <Feature icon={<ChartLine size={18} />} title="پیش‌بینی" desc="صدک‌های ۱۰/۵۰/۹۰ + مقایسه سناریوها + رتبه‌بندی ریسک" />
                      <Feature icon={<Database size={18} />} title="دیتاست‌ها" desc="آپلود، اعتبارسنجی، انتشار و گزارش کیفیت داده" />
                      <Feature icon={<Activity size={18} />} title="مدل‌ها" desc="کار آموزش، متریک‌ها، باقیمانده‌ها و فعال‌سازی/بازگشت نسخه" />
                      <Feature icon={<Shield size={18} />} title="کنترل دسترسی + ممیزی" desc="کنترل دسترسی نقش‌محور و لاگ ممیزی کامل" />
                      <Feature icon={<Bell size={18} />} title="هشدار و اعلان" desc="قانون‌ساز، تاریخچه فعال‌شدن و اعلان درون‌برنامه‌ای" />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[12px] text-muted">
                        دستیار پروژه به صورت پنجره پاپ‌آپ داخل سامانه فعال است.
                      </div>
                      <Link to="/login" className="text-primary hover:underline text-[12px]">
                        رفتن به صفحه ورود
                      </Link>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <div className="text-[12px] text-muted leading-relaxed text-right">
                      مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است.
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="mt-10 text-center text-[12px] text-muted">
              <span className="opacity-80">مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
