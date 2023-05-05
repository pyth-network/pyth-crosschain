import {
  ChainIdsTestnet,
  createExecutorForChain,
} from "./chains-manager/chains";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  InstantiateContractResponse,
  StoreCodeResponse,
} from "./chains-manager/chain-executor";
import { Pipeline } from "./pipeline";
import {
  WORMHOLE_CONTRACT_VERSION,
  getContractBytesDict,
  getWormholeContractAddress,
} from "./helper";
import { ExtendedChainsConfigTestnet } from "./extended-chain-config";

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("mnemonic", {
    type: "string",
    demandOption: "Please provide the mnemonic",
  })
  .option("contract-version", {
    type: "string",
    demandOption: `Please input the contract-version of the pyth contract.`,
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

async function run() {
  const STORAGE_DIR = "./testnet/instantiate-pyth";

  // get the wasm code from github
  let contractBytesDict = await getContractBytesDict(
    Object.values(ExtendedChainsConfigTestnet).map(
      ({ pythArtifactZipName }) => pythArtifactZipName
    ),
    argv.contractVersion
  );

  let chainIds = argv.chainId === undefined ? ChainIdsTestnet : [argv.chainId];
  for (let chainId of chainIds) {
    let pipelineStoreFilePath = `${STORAGE_DIR}/${chainId}-${argv.contractVersion}.json`;
    const pipeline = new Pipeline(chainId, pipelineStoreFilePath);

    const chainExecutor = createExecutorForChain(
      ExtendedChainsConfigTestnet[chainId],
      argv.mnemonic
    );

    // add stages
    // 1 deploy artifact
    pipeline.addStage({
      id: "deploy-pyth-code",
      executor: async () => {
        return chainExecutor.storeCode({
          contractBytes:
            contractBytesDict[
              ExtendedChainsConfigTestnet[chainId].pythArtifactZipName
            ],
        });
      },
    });

    // 2 instantiate contract
    pipeline.addStage({
      id: "instantiate-contract",
      executor: (getResultOfPastStage) => {
        const storeCodeRes: StoreCodeResponse =
          getResultOfPastStage("deploy-pyth-code");

        return chainExecutor.instantiateContract({
          codeId: storeCodeRes.codeId,
          instMsg: getPythConfig({
            feeDenom: ExtendedChainsConfigTestnet[chainId].feeDenom,
            wormholeChainId:
              ExtendedChainsConfigTestnet[chainId].wormholeChainId,
            wormholeContract: getWormholeContractAddress(
              chainId,
              WORMHOLE_CONTRACT_VERSION,
              false
            ),
          }),
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

function getPythConfig({
  feeDenom,
  wormholeContract,
  wormholeChainId,
}: {
  feeDenom: string;
  wormholeContract: string;
  wormholeChainId: number;
}) {
  return {
    wormhole_contract: wormholeContract,
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: wormholeChainId,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: feeDenom,
    },
    data_sources: [
      {
        emitter: Buffer.from(
          "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      {
        emitter: Buffer.from(
          "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
          "hex"
        ).toString("base64"),
        chain_id: 26,
      },
    ],
    governance_source: {
      emitter: Buffer.from(
        "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
        "hex"
      ).toString("base64"),
      chain_id: 1,
    },
  };
}

run();
