import { tailwindGlob } from "@pythnetwork/component-library";
import componentLibraryConfig from "@pythnetwork/component-library/tailwind-config";
import type { Config } from "tailwindcss";

const tailwindConfig = {
  content: [tailwindGlob, "src/components/**/*.{ts,tsx}"],
  presets: [componentLibraryConfig],
} satisfies Config;

export default tailwindConfig;
