import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../app/auth";
import { Button, Card, CardBody, Input, Label } from "../components/ui";
import { cn } from "../lib/cn";

const Schema = z.object({
  email: z.string().email("ایمیل معتبر نیست."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof Schema>;
type DemoAccounts = { password: string; accounts: Array<{ email: string; role: string; status: string }> };

export function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();

  const demoQ = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: () => auth.api<DemoAccounts>("/auth/demo-accounts", { method: "GET" }),
  });

  const roleLabel = React.useCallback(
    (role: string) => {
      const r = String(role);
      if (r === "viewer") return t("roles.viewer");
      if (r === "analyst") return t("roles.analyst");
      if (r === "admin") return t("roles.admin");
      if (r === "org_admin") return t("roles.org_admin");
      if (r === "super_admin") return t("roles.super_admin");
      return r;
    },
    [t]
  );

  const [pwVisible, setPwVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setInlineError(null);
    setBusy(true);
    try {
      await auth.login(values.email, values.password, Boolean(values.rememberMe));
      nav("/dashboard");
    } catch (e: any) {
      const status = e?.status;
      const code = e?.code;
      if (status === 401 || code === "INVALID_CREDENTIALS") {
        const msg = t("login.invalid");
        setInlineError(msg);
        toast.error(msg);
      } else if (status === 403) {
        const msg = t("login.locked");
        setInlineError(msg);
        toast.error(msg);
      } else if (status === 429 || code === "RATE_LIMITED") {
        const msg = "محدودیت تلاش ورود. لطفا کمی بعد تلاش کنید.";
        setInlineError(msg);
        toast.error(msg);
      } else {
        const msg = "خطا در ورود";
        setInlineError(msg);
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (auth.ready && auth.user) nav("/dashboard", { replace: true });
  }, [auth.ready, auth.user, nav]);

  return (
    <div className="min-h-full font-fa relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full blur-3xl bg-primary/15" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-[520px] w-[520px] rounded-full blur-3xl bg-primary-2/15" />

      <div className="min-h-full flex items-start lg:items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[1040px] grid gap-6 lg:grid-cols-2 items-start">
          <Card className="w-full overflow-hidden">
            <div
              className={cn(
                "px-5 py-4 border-b border-border",
                "bg-[radial-gradient(900px_340px_at_15%_-10%,rgba(18,92,255,0.22),transparent_55%),radial-gradient(700px_340px_at_85%_0%,rgba(4,205,159,0.18),transparent_55%)]"
              )}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl border border-border bg-card/70 grid place-items-center overflow-hidden shrink-0 shadow-soft-md">
                    <img src="/logo.svg" alt="لوگو" className="h-8 w-8 object-contain" />
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="text-[14px] font-semibold">{t("login.title")}</div>
                    <div className="text-[12px] text-muted truncate">{t("app.name")}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/"
                    className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="صفحه اول"
                  >
                    صفحه اول
                  </Link>
                  <button
                    className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition"
                    onClick={() => void auth.setTheme(auth.theme === "dark" ? "light" : "dark")}
                    type="button"
                    aria-label="پوسته"
                    title="پوسته"
                  >
                    {auth.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <CardBody>
              <div className="mt-1 lg:hidden rounded-2xl border border-border bg-card/50 p-3 text-right">
                <div className="text-[12px] font-semibold">حساب‌های دمو</div>
                <div className="mt-1 text-[12px] text-muted">
                  {demoQ.data ? `رمز عبور همه کاربران: ${demoQ.data.password}` : t("common.loading")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 justify-end">
                  {(demoQ.data?.accounts ?? []).slice(0, 5).map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition"
                      onClick={() => {
                        form.setValue("email", a.email);
                        form.setValue("password", demoQ.data?.password ?? "Password123!");
                      }}
                      title={roleLabel(a.role)}
                    >
                      {a.email}
                    </button>
                  ))}
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <div>
                  <Label>{t("login.email")}</Label>
                  <Input placeholder="مثال: viewer@demo.local" {...form.register("email")} autoComplete="email" />
                  {form.formState.errors.email ? (
                    <div className="mt-1 text-[12px] text-danger">{String(form.formState.errors.email.message)}</div>
                  ) : null}
                </div>

                <div>
                  <Label>{t("login.password")}</Label>
                  <div className="relative">
                    <Input
                      type={pwVisible ? "text" : "password"}
                      placeholder="مثال: Password123!"
                      {...form.register("password")}
                      autoComplete="current-password"
                      className="pl-12"
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-xl border border-border bg-card/60 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition"
                      onClick={() => setPwVisible((v) => !v)}
                      aria-label="نمایش/مخفی"
                      title="نمایش/مخفی"
                    >
                      {pwVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {form.formState.errors.password ? (
                    <div className="mt-1 text-[12px] text-danger">{String(form.formState.errors.password.message)}</div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-card/60 accent-primary"
                      {...form.register("rememberMe")}
                    />
                    <span>{t("login.remember")}</span>
                  </label>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => toast("در دمو این بخش غیرفعال است.")}
                  >
                    {t("login.forgot")}
                  </button>
                </div>

                {inlineError ? (
                  <div className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                    {inlineError}
                  </div>
                ) : null}

                <Button variant="primary" className="w-full" disabled={busy} type="submit">
                  {busy ? "در حال ورود..." : t("login.submit")}
                </Button>
              </form>

              <div className="mt-5 rounded-2xl border border-border bg-card/50 p-3 text-[12px] text-muted leading-relaxed">
                برای ورود می‌توانید از یکی از حساب‌های دمو استفاده کنید. رمز همه کاربران:{" "}
                <span className="font-mono">Password123!</span>
              </div>

              <div className="mt-4 text-[11px] text-muted">
                مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است.
              </div>
            </CardBody>
          </Card>

          <div className="hidden lg:block">
            <div className="h-full p-8 rounded-3xl border border-border bg-card/50 text-right">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl border border-border bg-card/70 grid place-items-center overflow-hidden shadow-soft-md">
                  <img src="/logo.svg" alt="لوگو" className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <div className="text-[18px] font-semibold">{t("app.name")}</div>
                  <div className="mt-1 text-[12px] text-muted">
                    پایش چاه‌ها، پیش‌بینی، سناریوهای اقلیمی، هشدار، گزارش‌ساز و مدیریت کاربران (دمو)
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-3">
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="text-[13px] font-semibold">حساب‌های دمو</div>
                  <div className="mt-2 text-[12px] text-muted">
                    {demoQ.data ? `رمز عبور همه کاربران: ${demoQ.data.password}` : t("common.loading")}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(demoQ.data?.accounts ?? []).slice(0, 5).map((a) => (
                      <button
                        key={a.email}
                        className="w-full rounded-xl border border-border bg-black/[0.02] dark:bg-white/[0.03] px-3 py-2 text-[12px] hover:bg-black/5 dark:hover:bg-white/5 transition text-right"
                        onClick={() => {
                          form.setValue("email", a.email);
                          form.setValue("password", demoQ.data?.password ?? "Password123!");
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{a.email}</span>
                          <span className="text-muted">{roleLabel(a.role)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="text-[13px] font-semibold">شروع سریع</div>
                  <ol className="mt-3 grid gap-2 text-[12px] text-muted">
                    <li>1) پس از ورود، از منو «داشبورد» وضعیت کلی را ببینید.</li>
                    <li>2) به «پایش چاه‌ها» بروید و یک چاه را برای مشاهده جزئیات انتخاب کنید.</li>
                    <li>3) از «پیش‌بینی‌ها» یک اجرای جدید بسازید و نتایج را مقایسه کنید.</li>
                    <li>4) در «هشدارها» یک قانون بسازید و تاریخچه فعال‌شدن را ببینید.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

