import * as tsNode from "ts-node";

const repl = tsNode.createRepl();
const service = tsNode.create({ ...repl.evalAwarePartialHost });
repl.setService(service);
repl.start();
repl.evalCode(
  "import { loadHotWallet, Vault } from './src/node/utils/governance';" +
    "import { SuiChain, CosmWasmChain, AptosChain, EvmChain, StarknetChain } from './src/core/chains';" +
    "import { SuiPriceFeedContract } from './src/core/contracts/sui';" +
    "import { CosmWasmWormholeContract, CosmWasmPriceFeedContract } from './src/core/contracts/cosmwasm';" +
    "import { EvmWormholeContract, EvmPriceFeedContract, EvmEntropyContract } from './src/core/contracts/evm';" +
    "import { AptosWormholeContract, AptosPriceFeedContract } from './src/core/contracts/aptos';" +
    "import { StarknetPriceFeedContract } from './src/core/contracts/starknet';" +
    "import { DefaultStore } from './src/node/utils/store';" +
    "import { toPrivateKey } from './src/core/base';" +
    "DefaultStore",
);
