import { useShallow } from "zustand/shallow";

import type { PythProStoreType } from "../../stores/pyth-pro-demo-store";
import { usePythProDemoStore } from "../../stores/pyth-pro-demo-store";

/**
 * extracts portions of the UI store
 * to read or update API tokens for various data providers
 */
export function useApiTokens() {
  /** store */
  return usePythProDemoStore(
    useShallow(
      (state) =>
        ({
          apiTokens: state.apiTokens,
          updateApiToken: state.updateApiToken,
        }) satisfies Pick<PythProStoreType, "apiTokens" | "updateApiToken">,
    ),
  );
}
