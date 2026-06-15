import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6C47FF",
          dark: "#5B3DD8",
          light: "#EEF0FF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
