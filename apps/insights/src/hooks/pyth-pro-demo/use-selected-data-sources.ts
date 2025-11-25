import { useShallow } from "zustand/shallow";

import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  DATA_SOURCES_CRYPTO,
  DATA_SOURCES_EQUITY,
  DATA_SOURCES_FOREX,
  DATA_SOURCES_FUTURES,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import type { PythProStoreType } from "../../stores/pyth-pro-demo-store";
import { usePythProDemoStore } from "../../stores/pyth-pro-demo-store";
import {
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedFutureSymbol,
} from "../../util/pyth-pro-demo";

/**
 * returns only the user's currently-selected
 * symbol and the derived data sources
 * required to power that demo
 */
export function useSelectedDataSources() {
  return usePythProDemoStore(
    useShallow((state) => {
      let dataSourcesInUse: AllDataSourcesType[] = [];
      if (isAllowedCryptoSymbol(state.selectedSource)) {
        dataSourcesInUse = Object.values(DATA_SOURCES_CRYPTO.Values);
      } else if (isAllowedForexSymbol(state.selectedSource)) {
        dataSourcesInUse = Object.values(DATA_SOURCES_FOREX.Values);
      } else if (isAllowedEquitySymbol(state.selectedSource)) {
        dataSourcesInUse = Object.values(DATA_SOURCES_EQUITY.Values);
      } else if (isAllowedFutureSymbol(state.selectedSource)) {
        dataSourcesInUse = Object.values(DATA_SOURCES_FUTURES.Values);
      }

      const out: Pick<PythProStoreType, "selectedSource"> & {
        dataSourcesInUse: AllDataSourcesType[];
      } = {
        dataSourcesInUse,
        selectedSource: state.selectedSource,
      };

      return out;
    }),
  );
}
