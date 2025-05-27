import { nextjs } from "@cprussin/eslint-config";

export default [
  ...nextjs,
  {
    ignores: [".source/**"],
  },
];
