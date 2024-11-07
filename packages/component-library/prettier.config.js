import { fileURLToPath } from "node:url";

import { base, tailwind, mergeConfigs } from "@cprussin/prettier-config";

const config = mergeConfigs([
  base,
  tailwind(fileURLToPath(import.meta.resolve("./tailwind.config.ts"))),
]);

export default config;
