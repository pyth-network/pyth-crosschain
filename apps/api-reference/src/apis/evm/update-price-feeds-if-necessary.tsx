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

export const updatePriceFeedsIfNecessary = writeApi<
  "updateData" | "priceId" | "publishTime" | "fee"
>({
  name: "updatePriceFeedsIfNecessary",
  summary:
    "Update the on-chain price feeds using the provided `updateData` only if the on-chain prices are older than the valid time period.",
  description: `
  This method updates the on-chain price feeds using the provided \`updateData\` if the on-chain data is not sufficiently fresh.


  The caller provides two matched arrays, \`priceIds\` and \`publishTimes\`.
  This function applies the update if there exists an index \`i\` such that \`priceIds[i]\`'s last \`publishTime\` is before than \`publishTimes[i]\`.
  Callers should typically pass \`publishTimes[i]\` to be equal to the publishTime of the corresponding price id in \`updateData\`.


  This method is a variant of [updatePriceFeeds](update-price-feeds) that reduces
  gas usage when multiple callers are sending the same price updates.

  This function requires the caller to pay a fee to perform the update.  The
  required fee for a given set of updates can be computed by passing them to
  [getUpdateFee](get-update-fee).

  This method returns the transaction hash of the update transaction.

  ### Error Response

  The above method can return the following error response:
  - \`NoFreshUpdate\`: The provided update is not fresh enough to apply. It means the provided \`publishTime\` is not equal to corresponding corresponding price id in \`updateData\`.
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
      name: "priceId",
      type: ParameterType.PriceFeedIdArray,
      description: "The price ids to update.",
    },
    {
      name: "publishTime",
      type: ParameterType.IntArray,
      description:
        "The timestamp for each price id that determines whether to apply the update.",
    },
    {
      name: "fee",
      type: ParameterType.Int,
      description:
        "The update fee in wei. This fee is sent as the value of the transaction.",
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
      ({ updateData, priceId, publishTime, fee }) => `
bytes[] memory updateData = new bytes[](1);
updateData[0] = ${updateData ? `hex"${updateData}` : "/* <updateData> */"};

bytes32[] memory priceIds = new bytes32[](1);
priceIds[0] = ${priceId ?? "/* <priceId> */"};

uint64[] memory publishTimes = new uint64[](1);
publishTimes[0] = ${publishTime ?? "/* <publishTime> */"};

uint fee = ${fee ?? "/* <fee> */"};
pyth.updatePriceFeedsIfNecessary{value: fee}(updateData, priceIds, publishTimes);
    `,
    ),
    ethersJS(
      ({ updateData, priceId, publishTime, fee }) => `
const updateData = ${updateData ? `['${updateData}']` : "/* <updateData> */"};
const priceIds = ${priceId ? `['${priceId}']` : "/* <priceId> */"};
const publishTimes = ${publishTime ? `[ethers.toBigInt(${publishTime})]` : "/* <publishTime> */"};
const fee = ethers.toBigInt(${fee ?? "/* <fee> */"});
const tx = await contract.updatePriceFeedsIfNecessary(updateData, priceIds, publishTimes, {value: fee});
const receipt = await tx.wait();
    `,
    ),
  ],
});

const getParams = async (
  priceId: string,
  ctx: {
    readContract: (name: string, args: unknown[]) => Promise<unknown>;
  },
) => {
  const feed = await getLatestPriceUpdate(priceId);
  const fee = await ctx.readContract("getUpdateFee", [[feed.binary.data]]);
  if (typeof fee !== "bigint") {
    throw new TypeError("Invalid fee");
  }
  return {
    updateData: feed.binary.data,
    priceId,
    publishTime: feed.parsed.price.publish_time.toString(),
    fee: fee.toString(),
  };
};
