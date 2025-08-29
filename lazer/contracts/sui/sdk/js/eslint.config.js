import { base } from "@cprussin/eslint-config";

export default [
  ...base,
  {
    ignores: ["eslint.config.js", "dist", "src/**/*.js"],
  },
];
