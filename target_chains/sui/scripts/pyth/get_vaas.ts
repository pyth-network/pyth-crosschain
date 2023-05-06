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
    "0x8b62866fcd3a25ff9118506444e9fe5171e67c61a049f4b4fdacdbc31ae862bb",
    "0x0e60a64dcbd660e87a08eb2cc95e8d84d1126fd7354d377b3fc5730352f4b8b2",
    "0x651071f8c7ab2321b6bdd3bc79b94a50841a92a6e065f9e3b8b9926a8fb5a5d1",
  ];
  const priceFeedVAAs = await connection.getLatestVaas(data);
  //console.log("number of VAAs: ", priceFeedVAAs.length)
  console.log(priceFeedVAAs);
}

main();
