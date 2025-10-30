import { base } from "@cprussin/eslint-config";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores(["**/schemas/*", "**/__tests__/*", "**/examples/*"]),
  ...base,
  { rules: { "unicorn/filename-case": "off" } },
];
