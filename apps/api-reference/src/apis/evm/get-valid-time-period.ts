import { readApi, solidity, ethersJS } from "./common";

export const getValidTimePeriod = readApi<never>({
  name: "getValidTimePeriod",
  description: `
Get the default valid time period in seconds.  This quantity is the maximum age
of price updates returned by functions like [getPrice](getPrice) and
[getEmaPrice](getEmaPrice); these functions revert if the current on-chain price
is older than this period.  The valid time period is configured to be a sane
default for each blockchain.
  `,
  parameters: [],
  examples: [],
  code: [
    solidity("uint validTimePeriod = pyth.getValidTimePeriod();"),
    ethersJS("const [validTimePeriod] = await contract.getValidTimePeriod();"),
  ],
});
