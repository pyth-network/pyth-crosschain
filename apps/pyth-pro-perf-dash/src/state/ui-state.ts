import { create } from "zustand";

import { SOURCE_PICKER_DROPDOWN_OPTIONS } from "../constants";
import type { DataPoint, PythProPerfDashState } from "../types";

export const useUIStateStore = create<PythProPerfDashState>()((set) => ({
  crypto: {},
  equities: {},
  forex: {},
  setDataPoint(which, thing, dataPoint) {
    set((prev) => {
      const arr = (prev[which][thing] ?? []) as DataPoint[];
      arr.push(dataPoint);

      // @ts-expect-error - typescript gets super confused about the narrowing here,
      // despite this being a safe operation
      prev[which][thing] = arr;
      return prev;
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  selectedSource: SOURCE_PICKER_DROPDOWN_OPTIONS[0]!,
  setSelectedSource(selectedSource) {
    set({ selectedSource });
  },
}));
