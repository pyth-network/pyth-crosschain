/// Fetch price feed VAAs of interest from the Pyth
/// price feed service.
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import axios from "axios";

async function main() {
  const connection = new PriceServiceConnection(
    "https://xc-testnet.pyth.network",
    {
      priceFeedRequestConfig: {
        binary: true,
      },
    }
  );

  // Fetch all price IDs
  //let {data} = await axios.get("https://xc-mainnet.pyth.network/api/price_feed_ids")
  //console.log("number of all price feed ids: ", data.length)

  let data = [
    "0x8b62866fcd3a25ff9118506444e9fe5171e67c61a049f4b4fdacdbc31ae862bb", // testnet
  ];
  const priceFeedVAAs = await connection.getLatestVaas(data);
  //console.log("number of VAAs: ", priceFeedVAAs.length)
  console.log(priceFeedVAAs);
}

main();
