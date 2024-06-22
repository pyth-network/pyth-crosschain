import Btc from "cryptocurrency-icons/svg/color/btc.svg";
import Eth from "cryptocurrency-icons/svg/color/eth.svg";

import { readApi, BTCUSD, ETHUSD, solidity, ethersJS } from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getEmaPriceUnsafe = readApi<"id">({
  name: "getEmaPriceUnsafe",
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

**This function may return a price from arbitrarily far in the past.** It is the
caller's responsibility to check the returned \`publishTime\` to ensure that the
update is recent enough for their use case.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
  `,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
  ],
  examples: [
    { name: "BTC/USD", icon: Btc, parameters: { id: BTCUSD } },
    { name: "ETH/USD", icon: Eth, parameters: { id: ETHUSD } },
  ],
  code: [
    solidity(
      ({ id }) => `
bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getEmaPriceUnsafe(priceId);
    `,
    ),
    ethersJS(
      ({ id }) => `
const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPriceUnsafe(priceId);
    `,
    ),
  ],
});
