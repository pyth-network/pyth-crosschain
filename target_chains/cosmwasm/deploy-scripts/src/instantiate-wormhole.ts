import { toPrivateKey } from "@pythnetwork/contract-manager/core/base";
import { CosmWasmChain } from "@pythnetwork/contract-manager/core/chains";
import {
  CosmWasmPriceFeedContract,
  CosmWasmWormholeContract,
} from "@pythnetwork/contract-manager/core/contracts/cosmwasm";
import { DefaultStore } from "@pythnetwork/contract-manager/node/utils/store";
import { CHAINS } from "@pythnetwork/xc-admin-common/chains";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";
import { getWormholeConfig } from "./configs.js";
import type { DeploymentType } from "./helper.js";

const yargs = createCLI(hideBin(process.argv));

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("private-key", {
    demandOption: "Please provide the private key",
    type: "string",
  })
  .option("contract-version", {
    default: "2.14.9",
    desc: `Please input the contract-version of the wormhole contract.
    There should be a compiled code at the path - "../wormhole-stub/artifacts/wormhole-\${contract-version}.wasm"`,
    type: "string",
  })
  .option("deploy", {
    choices: ["stable", "beta"],
    demandOption: "Please provide the deployment type",
    desc: "Execute this script for the given deployment type.",
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
  const wasmFilePath = `../wormhole-stub/artifacts/wormhole-${argv.contractVersion}.wasm`;

  const chain = DefaultStore.chains[argv.chain];
  if (!(chain instanceof CosmWasmChain)) {
    throw new Error(`Chain ${argv.chain} not found or not a CosmWasmChain`);
  }
  const privateKey = toPrivateKey(argv["private-key"]);
  const storeCodeRes = await CosmWasmPriceFeedContract.storeCode(
    chain,
    privateKey,
    wasmFilePath,
  );
  const chainExecutor = await chain.getExecutor(privateKey);
  const instantiateContractRes = await chainExecutor.instantiateContract({
    codeId: storeCodeRes.codeId,
    instMsg: getWormholeConfig({
      deploymentType: argv.deploy as DeploymentType, // TODO: use branded types
      feeDenom: chain.feeDenom,
      // @ts-expect-error - Chains can be safely indexed
      wormholeChainId: CHAINS[chain.wormholeChainName],
    }),
    label: "wormhole",
  });

  await chainExecutor.updateContractAdmin({
    contractAddr: instantiateContractRes.contractAddr,
    newAdminAddr: instantiateContractRes.contractAddr,
  });

  const contract = new CosmWasmWormholeContract(
    chain,
    instantiateContractRes.contractAddr,
  );
  if (argv.deploy === "stable") {
    // @ts-expect-error - TODO: typings indicate that syncMainnetGuardianSets() does not exist
    // on the contract object, which means this has a high probabiltiy to explode at runtime
    await contract.syncMainnetGuardianSets(privateKey);
  }

  DefaultStore.wormhole_contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
}

run();
