import * as tsNode from "ts-node";

const repl = tsNode.createRepl();
const service = tsNode.create({ ...repl.evalAwarePartialHost });
repl.setService(service);
repl.start();
repl.evalCode(
  "import { loadHotWallet, Vault } from './src/governance';" +
    "import { SuiChain, CosmWasmChain, AptosChain, EvmChain } from './src/chains';" +
    "import { SuiContract } from './src/contracts/sui';" +
    "import { WormholeCosmWasmContract, CosmWasmContract } from './src/contracts/cosmwasm';" +
    "import { WormholeEvmContract, EvmContract } from './src/contracts/evm';" +
    "import { AptosContract } from './src/contracts/aptos';" +
    "import { DefaultStore } from './src/store';" +
    "import { toPrivateKey } from './src/base';" +
    "DefaultStore"
);
