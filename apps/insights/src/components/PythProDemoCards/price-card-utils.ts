import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";

const MAX_PRECISION = 6;
const MIN_PRECISION = 2;

export const PriceCardUtils = {
  formatChange(
    change: Nullish<number>,
    changePercent: Nullish<number>,
  ): string {
    if (isNullOrUndefined(change) || isNullOrUndefined(changePercent)) {
      return "-";
    }
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(
      MAX_PRECISION,
    )} (${sign}${changePercent.toFixed(MAX_PRECISION)}%)`;
  },

  formatPrice(price: Nullish<number>): string {
    if (isNullOrUndefined(price)) return "No data";
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: MIN_PRECISION,
      maximumFractionDigits: MAX_PRECISION,
    });
  },
};
