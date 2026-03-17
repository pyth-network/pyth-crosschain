import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

const tailwindConfig = {
  content: ["src/components/**/*.{ts,tsx}", "src/markdown-components.tsx"],
  darkMode: "class",
  plugins: [forms],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
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
      fontFamily: {
        mono: ["var(--font-mono)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
} satisfies Config;

export default tailwindConfig;
