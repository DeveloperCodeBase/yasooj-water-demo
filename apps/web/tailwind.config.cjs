/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", ".theme-dark"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        fa: ["Vazirmatn", "ui-sans-serif", "system-ui"],
        en: ["\"Space Grotesk\"", "ui-sans-serif", "system-ui"],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-2": "rgb(var(--primary2) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
      },
      boxShadow: {
        "soft-lg": "0 14px 40px rgba(0,0,0,0.18)",
        "soft-md": "0 10px 26px rgba(0,0,0,0.14)",
      },
    },
  },
  plugins: [],
};
