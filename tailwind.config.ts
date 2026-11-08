import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: "#F5B700", dark: "#C99400", ink: "#1A1A1A" } },
    },
  },
  plugins: [],
};
export default config;
