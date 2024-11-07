import { fileURLToPath } from "node:url";

import { nextjs, tailwind, storybook } from "@cprussin/eslint-config";

const tailwindConfig = fileURLToPath(
  import.meta.resolve(`./tailwind.config.ts`),
);

export default [...nextjs, ...tailwind(tailwindConfig), ...storybook];
