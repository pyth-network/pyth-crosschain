import { base } from "@cprussin/eslint-config";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores([
    "**/schemas/*",
    "**/__tests__/*",
    // this file has syntax that the eslint parser doesn't understand and it blows up eslint
    "src/idl/wormhole_core_bridge_solana.ts",
  ]),
  ...base,
  { rules: { "unicorn/filename-case": "off" } },
];
