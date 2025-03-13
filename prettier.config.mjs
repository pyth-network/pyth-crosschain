import { base, mergeConfigs } from "@cprussin/prettier-config";
import solidity from "prettier-plugin-solidity";

const config = mergeConfigs([
  base,
  {
    plugins: [solidity],
  },
]);
export default config;
