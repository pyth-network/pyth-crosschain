import { base } from "@cprussin/eslint-config";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores(["src/examples/**/*"]),
  ...base,
  {
    rules: {
      "unicorn/filename-case": "off",
    },
  },
];
