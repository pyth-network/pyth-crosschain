import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

const tailwindConfig = {
  darkMode: "class",
  content: ["src/components/**/*.{ts,tsx}", "src/markdown-components.tsx"],
  plugins: [forms],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        pythpurple: {
          100: "#E6DAFE",
          400: "#BB86FC",
          600: "#6200EE",
          900: "#121212",
          950: "#0C0B1A",
        },
      },
    },
  },
} satisfies Config;

export default tailwindConfig;
