import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";

const palette: Partial<Record<AllDataSourcesType, string>> = {
  binance: "red",
  bybit: "blue",
  coinbase: "green",
  infoway_io: "aquamarine",
  okx: "orange",
  prime_api: "#ff4466",
  pyth: "purple",
  pyth_pro: "teal",
  twelve_data: "burlywood",
};

/**
 * normalizes colors used for all data sources
 */
export function getColorForSymbol(dataSource: AllDataSourcesType) {
  return palette[dataSource] ?? "gray";
}
