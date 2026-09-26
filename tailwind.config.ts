import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14181B",
        paper: "#FBF7F0",
        moss: "#1F4B3F",
        mossDeep: "#153730",
        clay: "#C1652E",
        gold: "#C9A227",
        line: "#E8E2D6",
        cardShadow: "rgba(20, 24, 27, 0.08)"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,24,27,0.04), 0 8px 24px rgba(20,24,27,0.08)"
      }
    }
  },
  plugins: []
};
export default config;
