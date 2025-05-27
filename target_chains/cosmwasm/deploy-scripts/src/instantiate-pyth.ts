import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sha256 } from "@cosmjs/crypto";
import { getPythConfig } from "./configs";
import { DefaultStore, Store } from "@pythnetwork/contract-manager/node/store";
import { CosmWasmChain } from "@pythnetwork/contract-manager/core/chains";
import { toPrivateKey } from "@pythnetwork/contract-manager/core/base";
import { CosmWasmPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/cosmwasm";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import { DeploymentType, getContractBytesDict } from "./helper";

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run instantiate-pyth -- <command>")
  .option("private-key", {
    type: "string",
    demandOption: "Please provide the private key",
  })
  .option("contract-version", {
    type: "string",
    demandOption: `Please input the contract-version of the pyth contract.`,
  })
  .option("deploy", {
    type: "string",
    desc: "Execute this script for the given networks.",
    choices: ["beta", "stable"],
    demandOption: "Please provide the deployment type",
  })
  .option("wormhole", {
    type: "string",
    desc: "Wormhole contract address deployed on the chain",
    demandOption: "Please provide the wormhole contract address",
  })
  .option("chain", {
    type: "string",
    desc: "Deploy the wormhole contract to the given chain",
    demandOption: "Please provide a chain to deploy the contract to",
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
  let contractBytesDict = await getContractBytesDict(
    [pythArtifactZipName],
    argv.contractVersion,
  );

  const checksum = Buffer.from(
    sha256(contractBytesDict[pythArtifactZipName]),
  ).toString("hex");

  console.log(`Downloaded wasm checksum ${checksum}`);

  const storeCodeRes = await chainExecutor.storeCode({
    contractBytes: contractBytesDict[pythArtifactZipName],
  });

  console.log(
    `Code stored on chain ${chain.getId()} at ${storeCodeRes.codeId}`,
  );

  const instantiateContractRes = await chainExecutor.instantiateContract({
    codeId: storeCodeRes.codeId,
    instMsg: getPythConfig({
      feeDenom: chain.feeDenom,
      wormholeChainId: CHAINS[chain.wormholeChainName],
      wormholeContract: argv.wormhole,
      deploymentType: argv.deploy as DeploymentType,
    }),
    label: "pyth",
  });
  const address = instantiateContractRes.contractAddr;
  console.log(`Contract instantiated at ${address}`);
  await chainExecutor.updateContractAdmin({
    newAdminAddr: address,
    contractAddr: address,
  });
  console.log(`Contract admin set to ${address}`);

  const contract = new CosmWasmPriceFeedContract(chain, address);
  DefaultStore.contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
  console.log("Added the following to your CosmWasm contracts configs");
  console.log(Store.serialize(contract));
}

run();
