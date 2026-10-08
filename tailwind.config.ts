import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef7f0", 100: "#d5ecd9", 500: "#2e8b3e", 600: "#247232", 700: "#1c5a28", 900: "#0f3317" },
        maroon: { 50: "#fbeff1", 100: "#f3d3d8", 500: "#8a2333", 600: "#7a1e2c", 700: "#5f1722" },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
