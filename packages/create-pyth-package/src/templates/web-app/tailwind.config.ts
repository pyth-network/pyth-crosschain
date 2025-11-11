import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";
import tailwindPlugin from "tailwindcss/plugin";
import animate from "tailwindcss-animate";
import reactAria from "tailwindcss-react-aria-components";

const tailwindConfig = {
  darkMode: "class",
  content: ["src/components/**/*.{ts,tsx}", "src/markdown-components.tsx"],
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
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
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
      height: {
        header: "var(--header-height)",
      },
      spacing: {
        "header-height": "var(--header-height)",
      },
      screens: {
        xs: "412px",
        "3xl": "2560px",
      },
    },
  },
} satisfies Config;

export default tailwindConfig;
