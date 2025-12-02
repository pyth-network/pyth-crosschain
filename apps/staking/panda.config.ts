import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,
  // Where to look for your css declarations
  include: [
    "./src/components/**/*.{ts,tsx,js,jsx}",
    "./src/app/**/*.{ts,tsx,js,jsx}",
  ],
  layers: {
    base: "pandabase",
    recipes: "pandarecipes",
    reset: "pandareset",
    tokens: "pandatokens",
    utilities: "pandautilities",
  },
  // Files to exclude
  exclude: [],
  // The output directory for your css system
  outdir: "styled-system",
});
