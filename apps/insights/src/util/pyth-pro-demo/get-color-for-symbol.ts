import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";

import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";

let palette: Nullish<Partial<Record<AllDataSourcesType, string>>>;

/**
 * these colors are now written as native CSS variables
 * with --theme-palette and --theme-color prefixes.
 * however, we don't have any JS-friendly variables holding these values
 * so we need to introspect them from the computed root style at runtime
 * and store them so we don't spend cycles constantly fetching these from the DOM
 */
function hydratePalette() {
  // we do a SSR guard here so this works in next.js
  const doc = globalThis.document as Nullish<typeof globalThis.document>;

  if (isNullOrUndefined(doc)) return palette;

  if (isNullOrUndefined(palette)) {
    const computedStyle = getComputedStyle(document.documentElement);

    palette = {
      binance: computedStyle.getPropertyValue("--theme-palette-yellow-400"),
      bybit: computedStyle.getPropertyValue("--theme-palette-orange-400"),
      coinbase: computedStyle.getPropertyValue("--theme-palette-blue-700"),
      infoway_io: computedStyle.getPropertyValue("--theme-palette-blue-300"),
      okx: computedStyle.getPropertyPriority("--theme-palette-gray-400"),
      prime_api: computedStyle.getPropertyValue("--theme-palette-red-600"),
      pyth: computedStyle.getPropertyValue("--theme-palette-purple-400"),
      pyth_pro: computedStyle.getPropertyValue("--theme-palette-purple-500"),
      twelve_data: computedStyle.getPropertyValue("--theme-palette-blue-500"),
    };
  }
  return palette;
}

/**
 * normalizes colors used for all data sources
 */
export function getColorForSymbol(dataSource: AllDataSourcesType) {
  const p = hydratePalette();
  return p?.[dataSource] ?? "gray";
}
