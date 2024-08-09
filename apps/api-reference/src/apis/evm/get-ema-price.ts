import { readApi, solidity, ethersJS } from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getEmaPrice = readApi<"id">({
  name: "getEmaPrice (deprecated)",
  summary: `
  Get the **latest** exponentially weighted moving average (EMA) price object for the requested price feed ID.

  **Note**: We recommend using [\`getEmaPriceNoOlderThan()\`](getEmaPriceNoOlderThan) instead of this endpoint
  as it gives more flexibility to specify the maximum age of the price.`,
  description: `
  This method returns the latest price object containing **exponentially-weighted moving average** price for the requested price feed ID.
  The \`price\` object contains the following fields:
  1. \`price\`: The latest **EMA** price of the price feed.
  2. \`conf\`: The confidence level of the price feed.
  3. \`expo\`: The exponent of the price feed.
  4. \`publishtime\`: The time when the price feed was last updated.

  Sample price object:
  \`\`\`json
  {
      price: 123456789n,
      conf: 180726074n,
      expo: -8,
      publishTime: 1721765108n
  }
  \`\`\`

  The \`price\` above is in the format of \`price * 10^expo\`. So, the \`price\` in above
  mentioned sample represents the number \`123456789 * 10(-8) = 1.23456789\` in
  this case.

  ### Error Response

  The above method can return the following error response:
  - \`StalePrice\`: The on-chain price has not been updated within the last
    [\`getValidTimePeriod()\`](getValidTimePeriod) seconds. Try calling
    [\`updatePriceFeeds()\`](updatePriceFeeds) to update the price feed with the
    latest price.
  - \`PriceFeedNotFound\`: The requested price feed has never received a price
    update or does not exist. Try calling
    [\`updatePriceFeeds()\`](updatePriceFeeds) to update the price feed.
  `,
  parameters: [
    {
      name: "id",
      type: ParameterType.PriceFeedId,
      description: "The ID of the price feed you want to read",
    },
  ],
  code: [
    solidity(
      ({ id }) => `
bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getEmaPrice(priceId);
    `,
    ),
    ethersJS(
      ({ id }) => `
const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPrice(priceId);
    `,
    ),
  ],
});
