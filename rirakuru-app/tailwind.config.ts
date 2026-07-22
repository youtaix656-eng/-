import type { Config } from "tailwindcss";

const config: Config = {
  // ダークモードは <html class="dark"> の付与で切り替える
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // リラクゼーション寄りの落ち着いた配色（ベージュ・ブラウン・オフホワイト）
        cream: {
          50: "#faf7f2",
          100: "#f4ede1",
          200: "#e8dcc8",
        },
        sand: {
          100: "#e7dccb",
          200: "#d8c7ac",
          300: "#c4ac86",
        },
        cocoa: {
          400: "#a67c52",
          500: "#8a6240",
          600: "#6f4e37",
          700: "#573d2b",
          800: "#3d2b1f",
          900: "#2a1e15",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Meiryo",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
