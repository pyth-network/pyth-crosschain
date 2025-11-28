import { base, mergeConfigs } from "@cprussin/prettier-config";
import solidity from "prettier-plugin-solidity";
import astro from 'prettier-plugin-astro';

const config = mergeConfigs([
  base,
  {
    plugins: [astro, solidity],
  },
]);
export default config;
