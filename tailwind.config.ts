import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#faf9f7",
        accent: "#2f6b4f",
      },
    },
  },
  plugins: [],
};
export default config;
