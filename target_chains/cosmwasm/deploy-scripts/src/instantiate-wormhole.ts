import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getWormholeConfig } from "./configs";
import {
  CosmWasmChain,
  CosmWasmPriceFeedContract,
  DefaultStore,
  toPrivateKey,
  CosmWasmWormholeContract,
} from "contract_manager";
import { CHAINS } from "xc_admin_common";
import { DeploymentType } from "./helper";

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("private-key", {
    type: "string",
    demandOption: "Please provide the private key",
  })
  .option("contract-version", {
    type: "string",
    desc: `Please input the contract-version of the wormhole contract.
    There should be a compiled code at the path - "../wormhole-stub/artifacts/wormhole-\${contract-version}.wasm"`,
    default: "2.14.9",
  })
  .option("deploy", {
    type: "string",
    desc: "Execute this script for the given deployment type.",
    choices: ["stable", "beta"],
    demandOption: "Please provide the deployment type",
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
  const wasmFilePath = `../wormhole-stub/artifacts/wormhole-${argv.contractVersion}.wasm`;

  const chain = DefaultStore.chains[argv.chain];
  if (!(chain instanceof CosmWasmChain)) {
    throw new Error(`Chain ${argv.chain} not found or not a CosmWasmChain`);
  }
  const privateKey = toPrivateKey(argv["private-key"]);
  const storeCodeRes = await CosmWasmPriceFeedContract.storeCode(
    chain,
    privateKey,
    wasmFilePath
  );
  console.log(
    `Code stored on chain ${chain.getId()} at ${storeCodeRes.codeId}`
  );
  const chainExecutor = await chain.getExecutor(privateKey);
  const instantiateContractRes = await chainExecutor.instantiateContract({
    codeId: storeCodeRes.codeId,
    instMsg: getWormholeConfig({
      feeDenom: chain.feeDenom,
      wormholeChainId: CHAINS[chain.wormholeChainName],
      deploymentType: argv.deploy as DeploymentType, // TODO: use branded types
    }),
    label: "wormhole",
  });
  console.log(
    `Contract instantiated at ${instantiateContractRes.contractAddr}`
  );

  await chainExecutor.updateContractAdmin({
    newAdminAddr: instantiateContractRes.contractAddr,
    contractAddr: instantiateContractRes.contractAddr,
  });
  console.log(`Contract admin set to ${instantiateContractRes.contractAddr}`);

  const contract = new CosmWasmWormholeContract(
    chain,
    instantiateContractRes.contractAddr
  );
  if (argv.deploy === "stable") {
    console.log("Syncing guardian sets for mainnet contract");
    await contract.syncMainnetGuardianSets(privateKey);
    console.log("Sync complete");
  }
  console.log(
    `Contract deployed on chain ${chain.getId()} at ${contract.address}`
  );
}

run();
