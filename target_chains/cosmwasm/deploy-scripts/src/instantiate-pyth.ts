import { sha256 } from "@cosmjs/crypto";
import { toPrivateKey } from "@pythnetwork/contract-manager/core/base";
import { CosmWasmChain } from "@pythnetwork/contract-manager/core/chains";
import { CosmWasmPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/cosmwasm";
import { DefaultStore } from "@pythnetwork/contract-manager/node/utils/store";
import { CHAINS } from "@pythnetwork/xc-admin-common/chains";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";
import { getPythConfig } from "./configs.js";
import type { DeploymentType } from "./helper.js";
import { getContractBytesDict } from "./helper.js";

const yargs = createCLI(hideBin(process.argv));

const argv = yargs
  .usage("USAGE: npm run instantiate-pyth -- <command>")
  .option("private-key", {
    demandOption: "Please provide the private key",
    type: "string",
  })
  .option("contract-version", {
    demandOption: `Please input the contract-version of the pyth contract.`,
    type: "string",
  })
  .option("deploy", {
    choices: ["beta", "stable"],
    demandOption: "Please provide the deployment type",
    desc: "Execute this script for the given networks.",
    type: "string",
  })
  .option("wormhole", {
    demandOption: "Please provide the wormhole contract address",
    desc: "Wormhole contract address deployed on the chain",
    type: "string",
  })
  .option("chain", {
    demandOption: "Please provide a chain to deploy the contract to",
    desc: "Deploy the wormhole contract to the given chain",
    type: "string",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

async function run() {
  const chain = DefaultStore.chains[argv.chain];
  if (!(chain instanceof CosmWasmChain)) {
    throw new Error(`Chain ${argv.chain} not found or not a CosmWasmChain`);
  }
  const privateKey = argv["private-key"];

  const chainExecutor = await chain.getExecutor(toPrivateKey(privateKey));
  let pythArtifactZipName = "cosmwasm";
  if (chain.getId().indexOf("osmosis") !== -1) {
    pythArtifactZipName = "osmosis";
  }
  if (chain.getId().indexOf("injective") !== -1) {
    pythArtifactZipName = "injective";
  }
  // get the wasm code from github
  const contractBytesDict = await getContractBytesDict(
    [pythArtifactZipName],
    argv.contractVersion,
  );

  const _checksum = Buffer.from(
    sha256(contractBytesDict[pythArtifactZipName]!),
  ).toString("hex");

  const storeCodeRes = await chainExecutor.storeCode({
    contractBytes: contractBytesDict[pythArtifactZipName]!,
  });

  const instantiateContractRes = await chainExecutor.instantiateContract({
    codeId: storeCodeRes.codeId,
    instMsg: getPythConfig({
      deploymentType: argv.deploy as DeploymentType,
      feeDenom: chain.feeDenom,
      // @ts-expect-error - the chain name can safely index the CHAINS object
      wormholeChainId: CHAINS[chain.wormholeChainName],
      wormholeContract: argv.wormhole,
    }),
    label: "pyth",
  });
  const address = instantiateContractRes.contractAddr;
  await chainExecutor.updateContractAdmin({
    contractAddr: address,
    newAdminAddr: address,
  });

  const contract = new CosmWasmPriceFeedContract(chain, address);
  DefaultStore.contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
}

run();
