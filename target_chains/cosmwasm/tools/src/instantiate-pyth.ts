import {
  ChainIdsMainnet,
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
  DeploymentType,
  WORMHOLE_CONTRACT_VERSION,
  getContractBytesDict,
  getPythFileName,
  getWormholeContractAddress,
} from "./helper";
import { sha256 } from "@cosmjs/crypto";
import { CHECKSUM } from "./contract-checksum";
import { getChainConfig, getContractConfig, getPythConfig } from "./configs";

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
  .option("deploy", {
    type: "string",
    desc: "Execute this script for the given networks.",
    choices: ["mainnet", "testnet-stable", "testnet-edge"],
    demandOption: "Please provide the deployment type",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

async function run() {
  let chainIds;
  if (argv.deploy === "mainnet") {
    chainIds = ChainIdsMainnet;
  } else if (argv.deploy === "testnet-stable") {
    chainIds = ChainIdsTestnet;
  } else if (argv.deploy === "testnet-edge") {
    chainIds = ChainIdsTestnet;
  } else {
    throw new Error("unknown deploy type " + argv.deploy);
  }

  // get the wasm code from github
  let contractBytesDict = await getContractBytesDict(
    chainIds.map(
      (chainId) =>
        getContractConfig(chainId, argv.deploy as DeploymentType)
          .pythArtifactZipName
    ),
    argv.contractVersion
  );

  // check that the downloaded code has the same checksum as the one hardcoded in contract-checksum.ts
  for (let key in contractBytesDict) {
    const hardcodedChecksum = CHECKSUM[argv.contractVersion][key];
    if (hardcodedChecksum === undefined)
      throw new Error(
        `Contract for ${key} doesn't have a checksum in "contract-checksum.ts"`
      );

    const downloadedCodeChecksum = Buffer.from(
      sha256(contractBytesDict[key])
    ).toString("hex");

    if (downloadedCodeChecksum !== hardcodedChecksum)
      throw new Error(
        `Checksum doesn't match for ${key}. \n Downloaded file checksum ${downloadedCodeChecksum}. Hardcoded checksum ${hardcodedChecksum}`
      );
  }

  for (let chainId of chainIds) {
    let chainConfig = getChainConfig(chainId, argv.deploy);
    let contractConfig = getContractConfig(chainId, argv.deploy);

    const pipeline = new Pipeline(
      chainId,
      getPythFileName(chainId, argv.contractVersion, argv.deploy)
    );

    const chainExecutor = createExecutorForChain(chainConfig, argv.mnemonic);

    // add stages
    // 1 deploy artifact
    pipeline.addStage({
      id: "deploy-pyth-code",
      executor: async () => {
        return chainExecutor.storeCode({
          contractBytes: contractBytesDict[contractConfig.pythArtifactZipName],
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
            feeDenom: contractConfig.feeDenom,
            wormholeChainId: contractConfig.wormholeChainId,
            wormholeContract: getWormholeContractAddress(
              chainId,
              WORMHOLE_CONTRACT_VERSION,
              argv.deploy as DeploymentType
            ),
            mainnet:
              argv.deploy === "mainnet" || argv.deploy === "testnet-stable",
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

run();
