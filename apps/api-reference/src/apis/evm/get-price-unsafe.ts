import { readApi, solidity, ethersJS } from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getPriceUnsafe = readApi<"id">({
  name: "getPriceUnsafe",
  summary:
    "Get the **last updated** price object for the requested price feed ID. _Caution: This function may return a price from arbitrarily in the the past_",
  description: `
Get the latest price and confidence interval for the requested price feed id.
The price feed id is a 32-byte id written as a hexadecimal string; see the
[price feed ids](https://pyth.network/developers/price-feed-ids) page to look up
the id for a given symbol. The returned price and confidence are decimal numbers
written in the form \`a * 10^e\`, where \`e\` is an exponent included in the
result. For example, a price of 1234 with an exponent of -2 represents the
number 12.34. The result also includes a \`publishTime\` which is the unix
timestamp for the price update.

**This function may return a price from arbitrarily far in the past.** It is the
caller's responsibility to check the returned \`publishTime\` to ensure that the
update is recent enough for their use case.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update. This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
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
PythStructs.Price memory currentBasePrice = pyth.getPriceUnsafe(priceId);
    `,
    ),
    ethersJS(
      ({ id }) => `
const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getPriceUnsafe(priceId);
    `,
    ),
  ],
});
