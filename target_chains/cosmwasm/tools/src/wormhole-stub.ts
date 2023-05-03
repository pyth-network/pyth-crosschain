import {
  ChainIdTestnet,
  ChainIdsTestnet,
  createExecutorForChain,
} from "./chains-manager/chains";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import {
  InstantiateContractResponse,
  StoreCodeResponse,
} from "./chains-manager/chain-executor";
import { Pipeline } from "./pipeline";
import { CHAINS } from "@pythnetwork/xc-governance-sdk";
const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("mnemonic", {
    type: "string",
    demandOption: "Please provide the mnemonic",
  })
  .option("contract-version", {
    type: "string",
    demandOption: `Please input the contract-version of the wormhole contract.
    There should be a compiled code at the path - "../wormhole-stub/artifacts/wormhole-\${contract-version}.wasm"`,
  })
  .option("chain-id", {
    type: "string",
    choices: ChainIdsTestnet,
  })
  .option("mainnet", {
    type: "boolean",
    desc: "Execute this script for mainnet networks. THIS WILL BE ADDED IN FUTURE",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

// IMPORTANT: IN ORDER TO RUN THIS SCRIPT FOR CHAINS
// WE NEED SOME METADATA
// HERE IS WHERE WE WILL BE ADDING THAT

// The type definition here make sure that the chain is added to xc_governance_sdk_js before this script was executed
type WormholeConfig = Record<
  ChainIdTestnet,
  { feeDenom: string; chainId: number }
>;
const wormholeConfig: WormholeConfig = {
  [ChainIdTestnet.INJECTIVE]: {
    feeDenom: "inj",
    chainId: CHAINS.injective,
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    feeDenom: "uosmo",
    chainId: CHAINS.osmosis,
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    feeDenom: "uosmo",
    chainId: CHAINS.osmosis,
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    feeDenom: "usei",
    chainId: CHAINS.sei,
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    feeDenom: "untrn",
    chainId: CHAINS.neutron,
  },
};

async function run() {
  const STORAGE_DIR = "../wormhole-stub/testnet";
  let wasmFilePath = `../wormhole-stub/artifacts/wormhole-${argv.contractVersion}.wasm`;

  // get the wormhole code
  const contractBytes = readFileSync(wasmFilePath);

  let chainIds = argv.chainId === undefined ? ChainIdsTestnet : [argv.chainId];
  for (let chainId of chainIds) {
    let pipelineStoreFilePath = `${STORAGE_DIR}/${chainId}-${argv.contractVersion}.json`;
    const pipeline = new Pipeline(chainId, pipelineStoreFilePath);

    const chainExecutor = createExecutorForChain(chainId, argv.mnemonic);

    // add stages
    // 1 deploy artifact
    pipeline.addStage({
      id: "deploy-wormhole-code",
      executor: async () => {
        return chainExecutor.storeCode({
          contractBytes,
        });
      },
    });

    // 2 instantiate contract
    pipeline.addStage({
      id: "instantiate-contract",
      executor: (getResultOfPastStage) => {
        const storeCodeRes: StoreCodeResponse = getResultOfPastStage(
          "deploy-wormhole-code"
        );

        return chainExecutor.instantiateContract({
          codeId: storeCodeRes.codeId,
          instMsg: getWormholeConfig(wormholeConfig[chainId]),
          label: "wormhole",
        });
      },
    });

    // 3 set its own admin
    pipeline.addStage({
      id: "set-own-admin",
      executor: (getResultOfPastStage) => {
        const instantiateContractRes: InstantiateContractResponse =
          getResultOfPastStage("instantiate-contract");

        return chainExecutor.updateContractAdmin({
          newAdminAddr: instantiateContractRes.contractAddr,
          contractAddr: instantiateContractRes.contractAddr,
        });
      },
    });

    await pipeline.run();
  }
}

function getWormholeConfig({
  feeDenom,
  chainId,
}: {
  feeDenom: string;
  chainId: number;
}) {
  return {
    chain_id: chainId,
    fee_denom: feeDenom,
    gov_chain: 1,
    gov_address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=",
    guardian_set_expirity: 86400,
    initial_guardian_set: {
      addresses: [{ bytes: "WMw65cCXshPOPIGXnhuflXB0aqU=" }],
      expiration_time: 0,
    },
  };
}

run();
