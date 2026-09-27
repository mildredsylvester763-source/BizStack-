import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12182B",
        mist: "#EEF1EE",
        vault: "#123B33",
        vaultDeep: "#0B2B25",
        brass: "#B98A2E",
        rule: "#D7DAD5",
        alert: "#B23A2E"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18,24,43,0.04), 0 12px 32px rgba(18,24,43,0.08)"
      }
    }
  },
  plugins: []
};
export default config;
