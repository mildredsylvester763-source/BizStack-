import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E1C",
        surface: "#121834",
        surfaceAlt: "#1A2142",
        text: "#E7E9F5",
        textMuted: "#8B92B0",
        line: "#232B4D",
        primary: "#5B6EF5",
        primaryDeep: "#4453D6",
        accent: "#8B5CF6",
        success: "#22C55E",
        warning: "#F5A524",
        danger: "#EF4444"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.2), 0 12px 32px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(91,110,245,0.25), 0 0 24px rgba(91,110,245,0.12)"
      }
    }
  },
  plugins: []
};
export default config;
