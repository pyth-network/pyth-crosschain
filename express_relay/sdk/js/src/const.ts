import { PublicKey } from "@solana/web3.js";
import { OpportunityAdapterConfig, SvmConstantsConfig } from "./types";

export const OPPORTUNITY_ADAPTER_CONFIGS: Record<
  string,
  OpportunityAdapterConfig
> = {
  op_sepolia: {
    chain_id: 11155420,
    opportunity_adapter_factory: "0xfA119693864b2F185742A409c66f04865c787754",
    opportunity_adapter_init_bytecode_hash:
      "0x3d71516d94b96a8fdca4e3a5825a6b41c9268a8e94610367e69a8462cc543533",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    weth: "0x74A4A85C611679B73F402B36c0F84A7D2CcdFDa3",
  },
  mode: {
    chain_id: 34443,
    opportunity_adapter_factory: "0x59F78DE21a0b05d96Ae00c547BA951a3B905602f",
    opportunity_adapter_init_bytecode_hash:
      "0xd53b8e32ab2ecba07c3e3a17c3c5e492c62e2f7051b89e5154f52e6bfeb0e38f",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    weth: "0x4200000000000000000000000000000000000006",
  },
};

export const SVM_CONSTANTS: Record<string, SvmConstantsConfig> = {
  "development-solana": {
    expressRelayProgram: new PublicKey(
      "PytERJFhAKuNNuaiXkApLfWzwNwSNDACpigT3LwQfou"
    ),
  },
};
