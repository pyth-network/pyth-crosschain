/// Fetch price feed VAAs of interest from the Pyth
/// price feed service.
import { PriceServiceConnection } from '@pythnetwork/price-service-client';
import { Buffer } from 'buffer';
async function main(){
    const connection = new PriceServiceConnection("https://xc-testnet.pyth.network", {
        priceFeedRequestConfig: {
          binary: true,
        },
    })
    // const priceIds = [
    //     "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    //     "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    //     "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c"
    // ];
    const priceIds = [
        "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"
    ]
    const priceFeedVAAs = await connection.getLatestVaas(priceIds);
    console.log(priceFeedVAAs)

}

main();
