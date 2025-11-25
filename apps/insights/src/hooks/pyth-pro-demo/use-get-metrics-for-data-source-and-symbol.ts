import { useCallback } from "react";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { usePythProDemoStore } from "../../stores/pyth-pro-demo-store";

/**
 * returns a callback you can use for grabbing
 * metrics for a specific data source and the selected symbol
 */
export function useGetMetricsForDataSourceAndSymbol() {
  /** store */
  const { metrics, selectedSource } = usePythProDemoStore();

  /** callbacks */
  const getMetricsForSourceAndSymbol = useCallback(
    (
      dataSource: AllDataSourcesType,
      symbol: AllAllowedSymbols = selectedSource,
    ) => metrics[dataSource]?.latest?.[symbol],
    [metrics, selectedSource],
  );

  return { getMetricsForSourceAndSymbol };
}
