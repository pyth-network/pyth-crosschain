import { useState } from "react";
import { HexString, Price } from "@pythnetwork/pyth-evm-js";
import { ExchangeRateMeta, timeAgo, TokenConfig } from "./utils";

export function PriceTicker(props: {
  price: Price | undefined;
  currentTime: Date;
  tokenName: string;
}) {
  const price = props.price;

  if (price === undefined) {
    return <span style={{ color: "grey" }}>loading...</span>;
  } else {
    const now = props.currentTime.getTime() / 1000;

    return (
      <div>
        <p>
          Pyth {props.tokenName} price:{" "}
          <span style={{ color: "green" }}>
            {" "}
            {price.getPriceAsNumberUnchecked().toFixed(3) +
              " ± " +
              price.getConfAsNumberUnchecked().toFixed(3)}{" "}
          </span>
        </p>
        <p>
          <span style={{ color: "grey" }}>
            last updated {timeAgo(now - price.publishTime)} ago
          </span>
        </p>
      </div>
    );
  }
}

/**
 * Show the current exchange rate with a tooltip for pyth prices.
 */
export function PriceText(props: {
  rate: ExchangeRateMeta | undefined;
  price: Record<HexString, Price>;
  currentTime: Date;
  baseToken: TokenConfig;
  quoteToken: TokenConfig;
}) {
  let basePrice = props.price[props.baseToken.pythPriceFeedId];
  let quotePrice = props.price[props.quoteToken.pythPriceFeedId];

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      {props.rate !== undefined ? (
        <div>
          Current Exchange Rate:{" "}
          <span className={"exchange-rate"}>{props.rate.rate.toFixed(4)}</span>{" "}
          <span
            className="icon-container"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            (details)
            {showTooltip && (
              <div className="tooltip">
                <PriceTicker
                  price={basePrice}
                  currentTime={props.currentTime}
                  tokenName={props.baseToken.name}
                />
                <PriceTicker
                  price={quotePrice}
                  currentTime={props.currentTime}
                  tokenName={props.quoteToken.name}
                />
              </div>
            )}
          </span>
          <p className={"last-updated"}>
            Last updated{" "}
            {timeAgo(
              (props.currentTime.getTime() -
                props.rate.lastUpdatedTime.getTime()) /
                1000
            )}{" "}
            ago
          </p>
        </div>
      ) : (
        <div>
          <p>Exchange rate is loading...</p>
        </div>
      )}
    </div>
  );
}
