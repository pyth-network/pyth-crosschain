import { readApi, solidity, ethersJS } from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getEmaPriceNoOlderThan = readApi<"id" | "age">({
  name: "getEmaPriceNoOlderThan",
  summary:
    "Get the exponentially weighted moving average (EMA) price object with a published timestamp from before than `age` seconds in the past.",
  description: `
Get the latest exponentially-weighted moving average (EMA) price and confidence
interval for the requested price feed id.  The price feed id is a 32-byte id
written as a hexadecimal string; see the [price feed
ids](https://pyth.network/developers/price-feed-ids) page to look up the id for
a given symbol.  The returned price and confidence are decimal numbers written
in the form \`a * 10^e\`, where \`e\` is an exponent included in the result.
For example, a price of 1234 with an exponent of -2 represents the number 12.34.
The result also includes a \`publishTime\` which is the unix timestamp for the
price update.  The EMA methodology is described in more detail in this [blog
post](https://pythnetwork.medium.com/whats-in-a-name-302a03e6c3e1).

The caller provides an \`age\` argument that specifies how old the price can be.
The call reverts with a \`StalePriceError\` if the on-chain price is from more
than \`age\` seconds in the past (with respect to the current on-chain
timestamp).  Call [updatePriceFeeds](updatePriceFeeds) to pull a fresh price
on-chain and solve this problem.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
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
PythStructs.Price memory currentBasePrice = pyth.getEmaPriceNoOlderThan(priceId, age);
    `,
    ),
    ethersJS(
      ({ id, age }) => `
const priceId = ${id ? `'${id}'` : "/* <id> */"};
const age = ${age ? `'${age}'` : "/* <age> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPriceNoOlderThan(priceId, age);
    `,
    ),
  ],
});
