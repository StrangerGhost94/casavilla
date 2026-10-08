import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Forest green — CasaVilla's primary colour
        brand: {
          50: "#eef5f1", 100: "#d9eae1", 200: "#b3d4c3", 300: "#7fb59b", 400: "#4c9274",
          500: "#2a7556", 600: "#1d6146", 700: "#17523b", 800: "#124331", 900: "#0e3628", 950: "#09251b",
        },
        // Gold accent (logo, highlights)
        gold: { 50: "#fbf6ea", 100: "#f4e8c9", 200: "#e9d397", 300: "#ddbb66", 400: "#d2a84a", 500: "#c4963a", 600: "#a87b2c", 700: "#865f24" },
        // Warm off-white page background
        cream: { DEFAULT: "#f6f4ee", 100: "#efece3" },
        // Errors, overdue
        maroon: { 50: "#fdf0ef", 100: "#f9d7d4", 500: "#c2372b", 600: "#a92d23", 700: "#86231b" },
      },
      fontFamily: {
        sans: ["\"Inter Variable\"", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["\"Playfair Display\"", "Georgia", "serif"],
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "sheet-up": { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        "load-bar": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "draw": { "0%": { strokeDashoffset: "240" }, "100%": { strokeDashoffset: "0" } },
        "ken-burns": { "0%": { transform: "scale(1.12)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.2,.7,.2,1) both",
        "fade-in": "fade-in .5s ease-out both",
        "sheet-up": "sheet-up .35s cubic-bezier(.2,.8,.2,1) both",
        "load-bar": "load-bar 1.5s cubic-bezier(.4,0,.2,1) both",
        draw: "draw 1.2s ease-out both",
        "ken-burns": "ken-burns 6s cubic-bezier(.2,.6,.2,1) both",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 54, 40, 0.04), 0 2px 8px rgba(14, 54, 40, 0.05)",
        float: "0 8px 24px rgba(14, 54, 40, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
