import { useShallow } from "zustand/shallow";

import type { PythProStoreType } from "../../stores/pyth-pro-demo-store";
import { usePythProDemoStore } from "../../stores/pyth-pro-demo-store";

/**
 * returns a specific portion of the zustand store
 * for usage in a specific websocket-provider's hook
 */
export function usePythProStoreStateForWebsocket() {
  /** store */
  return usePythProDemoStore(
    useShallow(
      (state) =>
        ({
          addDataPoint: state.addDataPoint,
          selectedSource: state.selectedSource,
        }) satisfies Pick<PythProStoreType, "addDataPoint" | "selectedSource">,
    ),
  );
}
