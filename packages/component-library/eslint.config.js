import { fileURLToPath } from "node:url";

import { react, tailwind, storybook } from "@cprussin/eslint-config";

const config = [
  ...react,
  ...tailwind(fileURLToPath(import.meta.resolve("./tailwind.config.ts"))),
  ...storybook,
];
export default config;
