import { readApi, solidity, ethersJS } from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getPriceNoOlderThan = readApi<"id" | "age">({
  name: "getPriceNoOlderThan",
  summary:
    "Get the price object with a published timestamp from before than `age` seconds in the past.",
  description: `
This method returns the latest price object for the requested price feed ID, if
it has been updated sufficiently recently.

The caller provides an **\`age\`** argument that specifies how old the price can be.

The price object contains the following fields:
1. \`price\`: The latest price of the price feed.
2. \`conf\`: The confidence level of the price feed.
3. \`expo\`: The exponent of the price feed.
4. \`publishtime\`: The time when the price feed was last updated.

Sample \`price\` object:
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
    {
      name: "age",
      type: ParameterType.Int,
      description: "Maximum age of the on-chain price in seconds.",
    },
  ],
  code: [
    solidity(
      ({ id, age }) => `
bytes32 priceId = ${id ?? "/* <id> */"};
uint256 age = ${age ?? "/* <age> */"};
PythStructs.Price memory currentBasePrice = pyth.getPriceNoOlderThan(priceId, age);
    `,
    ),
    ethersJS(
      ({ id, age }) => `
const priceId = ${id ? `'${id}'` : "/* <id> */"};
const age = ${age ? `'${age}'` : "/* <age> */"};
const [price, conf, expo, timestamp] = await contract.getPriceNoOlderThan(priceId, age);
    `,
    ),
  ],
});
