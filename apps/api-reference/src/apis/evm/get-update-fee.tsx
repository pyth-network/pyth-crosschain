import Btc from "cryptocurrency-icons/svg/color/btc.svg";
import Eth from "cryptocurrency-icons/svg/color/eth.svg";

import {
  readApi,
  BTCUSD,
  ETHUSD,
  getLatestPriceUpdate,
  solidity,
  ethersJS,
} from "./common";
import { ParameterType } from "../../components/EvmApi";

export const getUpdateFee = readApi<"updateData">({
  name: "getUpdateFee",
  summary:
    "Get the fee required to update the on-chain price feeds with the provided `updateData`.",
  description: `
  This method returns the fee required to update the on-chain price feeds for the given \`updateData\`.

  The fee returned is in **wei**.

  The caller should send the returned fee amount as the transaction value when calling [updatePriceFeeds](update-price-feeds).
  The \`updateData\` can be retrieved from the [Hermes API](https://hermes.pyth.network/docs).
  `,
  parameters: [
    {
      name: "updateData",
      type: ParameterType.HexArray,
      description:
        "The price updates that you would like to submit to [updatePriceFeeds](updatePriceFeeds). Fetch this data from [Hermes API](https://hermes.pyth.network/docs/#/rest/latest_price_updates).",
    },
  ],
  examples: [
    {
      name: "Latest BTC/USD update data",
      icon: Btc,
      parameters: () => getParams(BTCUSD),
    },
    {
      name: "Latest ETH/USD update data",
      icon: Eth,
      parameters: () => getParams(ETHUSD),
    },
  ],
  code: [
    solidity(
      ({ updateData }) => `
bytes[] memory updateData = new bytes[](1);
updateData[0] = ${updateData ? `hex"${updateData}` : "/* <updateData> */"};
uint feeAmount = pyth.getUpdateFee(updateData);
    `,
    ),
    ethersJS(
      ({ updateData }) => `
const updateData = ${updateData ? `['${updateData}']` : "/* <updateData> */"};
const [feeAmount] = await contract.getUpdateFee(updateData);
    `,
    ),
  ],
});

const getParams = async (feedId: string) => {
  const feed = await getLatestPriceUpdate(feedId);
  return { updateData: feed.binary.data };
};
