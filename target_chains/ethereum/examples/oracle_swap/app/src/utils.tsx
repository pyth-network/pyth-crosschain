import { BigNumber } from "ethers";

export interface TokenConfig {
  name: string;
  erc20Address: string;
  pythPriceFeedId: string;
  decimals: number;
}

export interface ExchangeRateMeta {
  rate: number;
  lastUpdatedTime: Date;
}

export interface ChainState {
  accountBaseBalance: BigNumber;
  accountQuoteBalance: BigNumber;
  poolBaseBalance: BigNumber;
  poolQuoteBalance: BigNumber;
}

/**
 * Generate a string rendering of a time delta. `diff` is the difference between the current
 * time and previous time in seconds.
 */
export function timeAgo(diff: number): string {
  if (diff > 60) {
    return `${(diff / 60).toFixed(0)}m`;
  } else if (diff < 2) {
    return "<2s";
  } else {
    return `${diff.toFixed(0)}s`;
  }
}

/**
 * Hacky function for converting a floating point number into a token quantity that's useful for ETH or ERC-20 tokens.
 * Note: this function assumes that decimals >= 6 (which is pretty much always the case for tokens)
 */
export function numberToTokenQty(
  x: number | string,
  decimals: number
): BigNumber {
  if (typeof x == "string") {
    x = Number.parseFloat(x);
  }
  return BigNumber.from(Math.floor(x * 1000000)).mul(
    BigNumber.from(10).pow(decimals - 6)
  );
}

/**
 * Hacky function for converting a token quantity back into a floating point number.
 * Note: this function assumes that decimals >= 6 (which is pretty much always the case for tokens)
 */
export function tokenQtyToNumber(x: BigNumber, decimals: number): number {
  const divided = x.div(BigNumber.from(10).pow(decimals - 6));

  return divided.toNumber() / 1000000;
}
