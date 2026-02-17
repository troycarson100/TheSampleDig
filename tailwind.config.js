/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "dig-lg": "1100px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-light": "var(--muted-light)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
      },
      fontFamily: {
        sans: "var(--font-geist-sans), system-ui, sans-serif",
        mono: "var(--font-geist-mono), ui-monospace, monospace",
      },
    },
  },
  plugins: [],
};
