import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin.js";
import animate from "tailwindcss-animate";
import reactAria from "tailwindcss-react-aria-components";

import { tailwindGlob } from "./src/index.js";

const tailwindConfig = {
  content: [tailwindGlob, ".storybook/**/*.tsx"],
  darkMode: "selector",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        beige: {
          50: "#F7F4F4",
          100: "#F3EDED",
          200: "#E9DFDF",
          300: "#D9C8C8",
          400: "#C1A8A8",
          500: "#A98A8A",
          600: "#927070",
          700: "#795C5C",
          800: "#664E4E",
          900: "#574545",
          950: "#2D2222",
        },
        steel: {
          50: "#F8F9FC",
          100: "#F1F2F9",
          200: "#E2E3F0",
          300: "#CBCEE1",
          400: "#9497B8",
          500: "#64678B",
          600: "#474A69",
          700: "#333655",
          800: "#1E1F3B",
          900: "#100F2A",
          950: "#050217",
        },
      },
      spacing: {
        "button-padding-xs": "0.25rem",
        "button-padding-sm": "0.5rem",
      },
      animation: {
        progress: "progress 1s infinite linear",
      },
      keyframes: {
        progress: {
          "0%": { transform: " translateX(0) scaleX(0)" },
          "40%": { transform: "translateX(0) scaleX(0.4)" },
          "100%": { transform: "translateX(100%) scaleX(0.5)" },
        },
      },
    },
  },
  plugins: [
    forms,
    animate,
    reactAria,
    plugin(({ addVariant }) => {
      addVariant("search-cancel", "&::-webkit-search-cancel-button");
      addVariant("search-decoration", "&::-webkit-search-decoration");
    }),
  ],
} satisfies Config;

export default tailwindConfig;
