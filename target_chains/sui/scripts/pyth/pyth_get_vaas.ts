/// Fetch price feed VAAs of interest from the Pyth
/// price feed service.
import { PriceServiceConnection } from '@pythnetwork/price-service-client';
import axios from 'axios';

async function main(){
    const connection = new PriceServiceConnection("https://xc-mainnet.pyth.network", {
        priceFeedRequestConfig: {
          binary: true,
        },
    })

    // Fetch all price IDs
    let {data} = await axios.get("https://xc-mainnet.pyth.network/api/price_feed_ids")
    console.log("number of all price feed ids: ", data.length)

    const priceFeedVAAs = await connection.getLatestVaas(data.slice(0, 100));
    console.log("number of VAAs: ", priceFeedVAAs.length)
}

main();
