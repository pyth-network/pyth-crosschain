import { SwapAdapterConfig } from "./types";

export const SWAP_ADAPTER_CONFIGS: Record<string, SwapAdapterConfig> = {
  mode: {
    chainId: 34443,
    multicallAdapter: "0xabc",
    liquidAssets: ["0x123", "0x456"],
  },
};
