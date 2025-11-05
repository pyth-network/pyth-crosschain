import { base } from "@cprussin/eslint-config";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores(["src/examples/**/*", "src/zodSchemas.ts"]),
  ...base,
  {
    rules: {
      "unicorn/filename-case": "off",
    },
  },
];
