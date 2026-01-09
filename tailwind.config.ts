import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"SF Pro Display"', '"Inter"', "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        sm: "0 6px 16px rgba(0,0,0,0.08)",
        md: "0 14px 40px rgba(0,0,0,0.10)",
        glow: "0 0 0 6px rgba(245, 158, 11, 0.12)",
      },
      colors: {
        bg: "#FAF7F2",
        surface: "#FFFFFF",
        surface2: "#FFF7ED",
        text: "#171717",
        text2: "#525252",
        border: "rgba(0,0,0,0.08)",
        accent: "#F59E0B",
        accent2: "#FB923C",
      },
    },
  },
  plugins: [],
} satisfies Config;

