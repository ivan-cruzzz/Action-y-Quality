/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--aq-background)",
        foreground: "var(--aq-foreground)",
        secondary: "var(--aq-secondary)",
        accent: {
          DEFAULT: "rgb(var(--aq-accent-rgb) / <alpha-value>)",
          pressed: "var(--aq-accent-pressed)",
        },
        card: "var(--aq-card)",
        cardBorder: "var(--aq-card-border)",
        error: "#E5484D",
        ok: "#30A46C",
        chart: {
          accent: "var(--accent)",
          surface: "var(--surface)",
        },
      },
      borderRadius: {
        card: "20px",
        field: "16px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        field: "0 2px 12px rgba(11,37,64,0.08)",
        glass: "0 12px 40px rgba(11,37,64,0.16)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
