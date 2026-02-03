import { react, storybook } from "@cprussin/eslint-config";

const config = [
  ...react,
  ...storybook,
  {
    rules: {
      "unicorn/filename-case": "off",
    },
  },
];
export default config;
