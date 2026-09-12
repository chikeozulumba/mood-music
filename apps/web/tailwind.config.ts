import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FAF9F5",
          100: "#F4F3EE",
          200: "#E8E6DE",
        },
        clay: {
          600: "#C2603F",
          700: "#B15A3B",
        },
        ink: {
          900: "#1F1E1C",
          700: "#403E3A",
          500: "#6B6862",
          300: "#A6A29A",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,30,28,0.06), 0 1px 8px rgba(31,30,28,0.06)",
        input: "0 2px 12px rgba(31,30,28,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
