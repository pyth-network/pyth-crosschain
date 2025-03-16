import { base } from "@cprussin/eslint-config";

export default [
  ...base,
  {
    rules: {
      "n/no-unpublished-import": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-node-protocol": "off",
    },
  },
];
