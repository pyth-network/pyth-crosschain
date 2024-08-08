import { fileURLToPath } from "node:url";

import { base, tailwind, mergeConfigs } from "@cprussin/prettier-config";

const tailwindConfig = fileURLToPath(
  import.meta.resolve(`./tailwind.config.ts`),
);

export default mergeConfigs([base, tailwind(tailwindConfig)]);
