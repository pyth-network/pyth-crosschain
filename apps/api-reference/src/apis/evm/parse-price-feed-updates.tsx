import {
  BTCUSD,
  ETHUSD,
  getLatestPriceUpdate,
  solidity,
  ethersJS,
  writeApi,
} from "./common";
import { ParameterType } from "../../components/EvmApi";

export const parsePriceFeedUpdates = writeApi<
  "updateData" | "priceId" | "minPublishTime" | "maxPublishTime" | "fee"
>({
  name: "parsePriceFeedUpdates",
  summary:
    "Parse `updateData` to return prices if the prices are published within the given time range.",
  description: `
  This method parse \`updateData\` and return the price feeds for the given \`priceIds\`
  within, if they are all published between \`minPublishTime\` and
  \`maxPublishTime\` (\`minPublishTime <= publishTime <= maxPublishTime\`).

  Use this function if you want to use a Pyth price for a fixed time and not the most
  recent price; otherwise, consider using [updatePriceFeeds](update-price-feeds)
  followed by [getPriceNoOlderThan](get-price-no-older-than) or one of its variants.

  Unlike [updatePriceFeeds](updatePriceFeeds), calling this function will **not** update the on-chain price.

  If you need to make sure the price update is the earliest update after the
  \`minPublishTime\` consider using
  [parsePriceFeedUpdatesUnique](parse-price-feed-updates-unique).

  This method requires the caller to pay a fee in wei; the required fee can be
  computed by calling [getUpdateFee](get-update-fee) with \`updateData\`.

  ### Error Response

  The above method can return the following error response:
  - \`PriceFeedNotFoundWithinRange\`: No price feed was found within the given time range.
  - \`InvalidUpdateData\`: The provided update data is invalid or incorrectly signed.
  - \`InsufficientFee\`: The fee provided is less than the required fee. Try calling [getUpdateFee](getUpdateFee) to get the required fee.
  `,
  parameters: [
    {
      name: "updateData",
      type: ParameterType.HexArray,
      description:
        "The price update data for the contract to verify. Fetch this data from [Hermes API](https://hermes.pyth.network/docs/#/rest/latest_price_updates).",
      defaultValue:
        "0x504e41550100000003b801000000040d00cea20e5677f66ed178e9410ddd8280617c06921916e8fd4b71e597d7f6c6d0a14daf3bb3e1a0d8c9e051c8d0................",
    },
    {
      name: "priceId",
      type: ParameterType.PriceFeedIdArray,
      description: "The price ids whose feeds will be returned.",
    },
    {
      name: "minPublishTime",
      type: ParameterType.Int,
      description: "The minimum timestamp for each returned feed.",
      defaultValue: "1721765108",
    },
    {
      name: "maxPublishTime",
      type: ParameterType.Int,
      description: "The maximum timestamp for each returned feed.",
      defaultValue: "1721765108",
    },
    {
      name: "fee",
      type: ParameterType.Int,
      description:
        "The update fee in wei. This fee is sent as the value of the transaction.",
      defaultValue: "1",
    },
  ],
  valueParam: "fee",
  examples: [
    {
      name: "Latest BTC/USD update data",
      parameters: (ctx) => getParams(BTCUSD, ctx),
    },
    {
      name: "Latest ETH/USD update data",
      parameters: (ctx) => getParams(ETHUSD, ctx),
    },
  ],
  code: [
    solidity(
      ({ updateData, priceId, minPublishTime, maxPublishTime, fee }) => `
bytes[] memory updateData = new bytes[](1);
updateData[0] = ${updateData ? `hex"${updateData}` : "/* <updateData> */"};

bytes32[] memory priceIds = new bytes32[](1);
priceIds[0] = ${priceId ?? "/* <priceId> */"};

uint64 minPublishTime = ${minPublishTime ?? "/* <minPublishTime> */"};
uint64 maxPublishTime = ${maxPublishTime ?? "/* <maxPublishTime> */"};

uint fee = ${fee ?? "/* <fee> */"};
pyth.parsePriceFeedUpdates{value: fee}(updateData, priceIds, minPublishTime, maxPublishTime);
    `,
    ),
    ethersJS(
      ({ updateData, priceId, minPublishTime, maxPublishTime, fee }) => `
const updateData = ${updateData ? `['${updateData}']` : "/* <updateData> */"};
const priceIds = ${priceId ? `['${priceId}']` : "/* <priceId> */"};
const minPublishTime = ethers.toBigInt(${minPublishTime ?? "/* <minPublishTime> */"});
const maxPublishTime = ethers.toBigInt(${maxPublishTime ?? "/* <maxPublishTime> */"});
const fee = ethers.toBigInt(${fee ?? "/* <fee> */"});
const tx = await contract.parsePriceFeedUpdates(updateData, priceIds, minPublishTime, maxPublishTime, {value: fee});
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
    minPublishTime: (feed.parsed.price.publish_time - 5).toString(),
    maxPublishTime: (feed.parsed.price.publish_time + 5).toString(),
    fee: fee.toString(),
  };
};
