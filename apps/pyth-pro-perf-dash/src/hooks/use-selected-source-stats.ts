import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { useUIStateStore } from "../state/ui-state";

/**
 * selects a portion of the UI state
 * required to display stats, metrics
 * and plot data
 */
export function useSelectedSourceStats() {
  const out = useUIStateStore(
    useShallow((state) => ({
      crypto: state.crypto,
      equities: state.equities,
      forex: state.forex,
      selectedSource: state.selectedSource,
    })),
  );

  return useMemo(() => out, [out]);
}
