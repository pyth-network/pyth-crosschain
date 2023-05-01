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
        "0x61226d39beea19d334f17c2febce27e12646d84675924ebb02b9cdaea68727e3"
    ]
    const priceFeedVAAs = await connection.getLatestVaas(priceIds);
    console.log(priceFeedVAAs)

    let x = Buffer.from([19,148,123,212,139,24,229,63,218,238,231,127,52,115,57,26,199,39,198,56]).toString("hex")
    console.log(x)

}

main();

