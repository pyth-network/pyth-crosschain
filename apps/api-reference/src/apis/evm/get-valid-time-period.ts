import { readApi, solidity, ethersJS } from "./common";

export const getValidTimePeriod = readApi<never>({
  name: "getValidTimePeriod (deprecated)",
  summary: `
  Get the default valid time period of price freshness in seconds.
  `,
  description: `
  This method returns the default valid time period of price freshness in **seconds**.
  This quantity is the maximum age of price updates returned by functions like [getPrice](getPrice) and
  [getEmaPrice](getEmaPrice); these functions revert if the current on-chain price
  is older than this period.

  **NOTE**: We recommend using [\`getPriceNoOlderThan()\`](getPriceNoOlderThan) or [\`getEmaPriceNoOlderThan()\`](getEmaPriceNoOlderThan) instead of [getPrice](getPrice) and
  [getEmaPrice](getEmaPrice).

The valid time period is configured to be a same default for each blockchain.
  `,
  parameters: [],
  code: [
    solidity("uint validTimePeriod = pyth.getValidTimePeriod();"),
    ethersJS("const [validTimePeriod] = await contract.getValidTimePeriod();"),
  ],
});
