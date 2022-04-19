
To get started, use the shortcut "⌘ + Shift + V" to preview the markdown. Alternatively, click on the preview button on the top right corner.

## Question 
This is the usage:

### Code Snippets

[third_party/pyth/price-service/src/rest.ts#L77](third_party/pyth/price-service/src/rest.ts#L77)	
````typescript
      res.write(latestPriceInfo.priceFeed.toJson());

````

[third_party/pyth/p2w-sdk/js/src/index.ts#L261](third_party/pyth/p2w-sdk/js/src/index.ts#L261)	
````typescript
export function priceAttestationToPriceFeed(priceAttestation: PriceAttestation): PriceFeed {
    console.log(`status: ${priceAttestation.status}`);
    let status;
    if (priceAttestation.status === 0) {
        status = PriceStatus.Unknown;
    } else if (priceAttestation.status === 1) {
        status = PriceStatus.Trading;
    } else if (priceAttestation.status === 2) {
        status = PriceStatus.Halted;
    } else if (priceAttestation.status === 3) {
        status = PriceStatus.Auction;
    } else {
        throw(new Error(`Invalid attestation status: ${priceAttestation.status}`));
    }

    return new PriceFeed ({
        id: priceAttestation.priceId,
        status: status,
        expo: priceAttestation.exponent,
        product_id: priceAttestation.productId,
        publish_time: 0,
        max_num_publishers: 0,
        num_publishers: 0,
        price: priceAttestation.price.toString(),
        conf: priceAttestation.confidenceInterval.toString(),
        ema_price: priceAttestation.emaPrice.value.toString(),
        ema_conf: priceAttestation.emaConfidence.value.toString(),
        prev_price: "0",
        prev_conf: "0",
        prev_publish_time: 0
    })
}

````

### Terminal Output
````bash

````
	