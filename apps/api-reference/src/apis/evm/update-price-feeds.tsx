import Btc from "cryptocurrency-icons/svg/color/btc.svg";
import Eth from "cryptocurrency-icons/svg/color/eth.svg";

import {
  BTCUSD,
  ETHUSD,
  getLatestPriceUpdate,
  solidity,
  ethersJS,
  writeApi,
} from "./common";
import { ParameterType } from "../../components/EvmApi";

export const updatePriceFeeds = writeApi<"updateData" | "fee">({
  name: "updatePriceFeeds",
  summary: "Update the on-chain price feeds using the provided `updateData`.",
  description: `
  This method updates the on-chain price feeds using the provided \`updateData\`, which contains serialized and signed price update data from Pyth Network.
  You can retrieve the latest price \`updateData\` for a given set of price feeds from the [Hermes API](https://hermes.pyth.network/docs).


  This method updates the on-chain price if the provided update is more recent than the current on-chain price. Otherwise, the provided update will be ignored. The method call will succeed even if the update is ignored.

  This function requires the caller to pay a fee to perform the update.  The
  required fee for a given set of updates can be computed by passing them to
  [getUpdateFee](getUpdateFee).

  This method returns the transaction hash of the update transaction.

  ### Error Response

  The above method can return the following error response:
  - \`InvalidUpdateData\`: The provided update data is invalid or incorrectly signed.
  - \`InsufficientFee\`: The fee provided is less than the required fee. Try calling [getUpdateFee](getUpdateFee) to get the required fee.
  `,
  parameters: [
    {
      name: "updateData",
      type: ParameterType.HexArray,
      description:
        "The price update data for the contract to verify. Fetch this data from [Hermes API](https://hermes.pyth.network/docs/#/rest/latest_price_updates).",
    },
    {
      name: "fee",
      type: ParameterType.Int,
      description:
        "The update fee in **wei**. This fee is sent as the value of the transaction.",
    },
  ],
  valueParam: "fee",
  examples: [
    {
      name: "Latest BTC/USD update data",
      icon: Btc,
      parameters: (ctx) => getParams(BTCUSD, ctx),
    },
    {
      name: "Latest ETH/USD update data",
      icon: Eth,
      parameters: (ctx) => getParams(ETHUSD, ctx),
    },
  ],
  code: [
    solidity(
      ({ updateData, fee }) => `
bytes[] memory updateData = new bytes[](1);
updateData[0] = ${updateData ? `hex"${updateData}` : "/* <updateData> */"};
uint fee = ${fee ?? "/* <fee> */"};
pyth.updatePriceFeeds{value: fee}(updateData);
    `,
    ),
    ethersJS(
      ({ updateData, fee }) => `
const updateData = ${updateData ? `['${updateData}']` : "/* <updateData> */"};
const fee = ethers.toBigInt(${fee ?? "/* <fee> */"});
const tx = await contract.updatePriceFeeds(updateData, {value: fee});
const receipt = await tx.wait();
    `,
    ),
  ],
});

const getParams = async (
  feedId: string,
  ctx: {
    readContract: (name: string, args: unknown[]) => Promise<unknown>;
  },
) => {
  const feed = await getLatestPriceUpdate(feedId);
  const fee = await ctx.readContract("getUpdateFee", [[feed.binary.data]]);
  if (typeof fee !== "bigint") {
    throw new TypeError("Invalid fee");
  }
  return {
    updateData: feed.binary.data,
    fee: fee.toString(),
  };
};
