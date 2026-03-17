import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";
import tailwindPlugin from "tailwindcss/plugin";
import animate from "tailwindcss-animate";
import reactAria from "tailwindcss-react-aria-components";

const tailwindConfig = {
  content: ["src/components/**/*.{ts,tsx}", "src/markdown-components.tsx"],
  darkMode: "class",
  plugins: [
    forms,
    animate,
    reactAria,
    tailwindPlugin((plugin) => {
      plugin.addVariant("search-cancel", "&::-webkit-search-cancel-button");
      plugin.addVariant("search-decoration", "&::-webkit-search-decoration");
    }),
  ],
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
          800: "#100E21",
          900: "#131223",
          950: "#0C0B1A",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)"],
        sans: ["var(--font-sans)"],
      },
      height: {
        header: "var(--header-height)",
      },
      screens: {
        "3xl": "2560px",
        xs: "412px",
      },
      spacing: {
        "header-height": "var(--header-height)",
      },
    },
  },
} satisfies Config;

export default tailwindConfig;
