import * as tsNode from "ts-node";

const repl = tsNode.createRepl();
const service = tsNode.create({ ...repl.evalAwarePartialHost });
repl.setService(service);
repl.start();
repl.evalCode(
  "import { loadHotWallet, Vault } from './src/governance';" +
    "import { SuiChain, CosmWasmChain, AptosChain, EvmChain, StarknetChain } from './src/chains';" +
    "import { SuiPriceFeedContract } from './src/contracts/sui';" +
    "import { CosmWasmWormholeContract, CosmWasmPriceFeedContract } from './src/contracts/cosmwasm';" +
    "import { EvmWormholeContract, EvmPriceFeedContract, EvmEntropyContract, EvmExpressRelayContract } from './src/contracts/evm';" +
    "import { AptosWormholeContract, AptosPriceFeedContract } from './src/contracts/aptos';" +
    "import { StarknetPriceFeedContract } from './src/contracts/starknet';" +
    "import { DefaultStore } from './src/store';" +
    "import { toPrivateKey } from './src/base';" +
    "DefaultStore",
);
