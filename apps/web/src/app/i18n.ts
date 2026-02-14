import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  fa: {
    translation: {
      "app.name": "سامانه تصمیم‌یار آب زیرزمینی (دمو)",
      "nav.dashboard": "داشبورد",
      "nav.wells": "پایش چاه‌ها",
      "nav.forecasts": "پیش‌بینی‌ها",
      "nav.notifications": "اعلان‌ها",
      "nav.reports": "گزارش‌ها",
      "nav.profile": "تنظیمات پروفایل",
      "nav.datasets": "دیتاست‌ها",
      "nav.scenarios": "سناریوهای اقلیمی",
      "nav.models": "مدل‌ها",
      "nav.alerts": "هشدارها",
      "nav.users": "مدیریت کاربران",
      "nav.orgSettings": "تنظیمات سازمان",
      "nav.audit": "لاگ ممیزی",
      "nav.orgs": "مدیریت سازمان‌ها",
      "common.search": "جستجو",
      "common.apply": "اعمال",
      "common.reset": "بازنشانی",
      "common.save": "ذخیره",
      "common.cancel": "انصراف",
      "common.loading": "در حال بارگذاری...",
      "common.exportCsv": "خروجی سی‌اس‌وی",
      "common.exportPdf": "خروجی پی‌دی‌اف",
      "login.title": "ورود",
      "login.email": "ایمیل",
      "login.password": "رمز عبور",
      "login.remember": "مرا به خاطر بسپار",
      "login.forgot": "فراموشی رمز عبور؟",
      "login.submit": "ورود",
      "login.invalid": "ایمیل یا رمز عبور اشتباه است",
      "login.locked": "حساب کاربری قفل/مسدود است",
      "filters.plain": "دشت",
      "filters.aquifer": "آبخوان",
      "filters.from": "از",
      "filters.to": "تا",
      "filters.scenario": "سناریو",
      "roles.viewer": "بیننده",
      "roles.analyst": "تحلیلگر",
      "roles.admin": "مدیر",
      "roles.org_admin": "مدیر سازمان",
      "roles.super_admin": "ابرمدیر"
    }
  }
} as const;

export type Lang = keyof typeof resources;

export function initI18n(initialLang: Lang) {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    resources,
    lng: "fa",
    fallbackLng: "fa",
    interpolation: { escapeValue: false }
  });
  return i18n;
}

export function applyLangToDocument(lang: Lang) {
  document.documentElement.lang = "fa";
  document.documentElement.dir = "rtl";
  document.documentElement.classList.add("lang-fa");
}
