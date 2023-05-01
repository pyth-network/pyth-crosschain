import { ChainId, createExecutorForChain } from "./chains-manager/chains";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import {
  InstantiateContractResponse,
  StoreCodeResponse,
} from "./chains-manager/chain-executor";
import { Pipeline, Step } from "./pipeline";
import { CHAINS } from "@pythnetwork/xc-governance-sdk";
const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("mnemonic", {
    type: "string",
  })
  .option("mainnet", {
    type: "boolean",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

async function run() {
  if (argv.mnemonic === undefined) {
    console.log("Please provide the mnemonic");
    return;
  }

  // IMPORTANT: IN ORDER TO RUN THIS SCRIPT FOR OTHER CHAINS
  // WE NEED SOME METADATA
  // HERE IS WHERE WE WILL ADDING THAT
  // REPLACE THIS PART OF THE CODE FOR NEW CHAINS
  const chainIds = [ChainId.NEUTRON_TESTNET_PION_1];
  // Wormhole info should be there for each chain id in `chainIds`.
  const wormholeInfo = {
    [ChainId.NEUTRON_TESTNET_PION_1]: {
      feeDenom: "untrn",
      chainId: "neutron",
    },
  };
  // We are checking that the chainIds are present in `xc_governance_sdk_js`s
  for (let chainId of chainIds) {
    // @ts-ignore
    let chain = wormholeInfo[chainId].chainId;

    // @ts-ignore
    if (CHAINS[chain] === undefined)
      throw new Error(
        `Chain Id: ${chainId} is not defined in wormhole Chains. Please add it there in the governance sdk js before moving forward`
      );
  }

  // get the wormhole code
  const contractBytes = readFileSync(
    "../wormhole-stub/artifacts/wormhole.wasm"
  );
  // pipeline
  const pipeline = new Pipeline("wormhole-stub", chainIds);
  // store it on all the chains
  pipeline.addStage(
    "deploy-wormhole-code",
    getDeployWormholeCodeStep(argv.mnemonic, contractBytes)
  );
  // instantiate the contract on chain
  pipeline.addStage(
    "instantiate-wormhole",
    getInstantiateWormholeStep(
      argv.mnemonic,
      "deploy-wormhole-code",
      wormholeInfo,
      argv.mainnet
    )
  );
  // set it to its own admin
  pipeline.addStage(
    "set-own-admin",
    getSetAdminStep(argv.mnemonic, "instantiate-wormhole")
  );

  await pipeline.run();
}

// All the steps getter below returns a closure which helps them with information
// required to process a step

function getDeployWormholeCodeStep(
  mnemonic: string,
  contractBytes: Buffer
): Step {
  return (chainId: string) => {
    const chainExecutor = createExecutorForChain(chainId as ChainId, mnemonic);

    return chainExecutor.storeCode({
      contractBytes,
    });
  };
}

function getInstantiateWormholeStep(
  mnemonic: string,
  deployCodeStageId: string,
  wormholeChainInfo: any,
  mainnet?: boolean
): Step {
  return (chainId, getResultOfPastStage) => {
    // @ts-ignore
    const wormholeChainId = CHAINS[wormholeChainInfo[chainId].chainId];
    if (wormholeChainId === undefined)
      throw new Error(`wormhole chain id undefined for chain: ${chainId}`);
    const feeDenom = wormholeChainInfo[chainId].feeDenom;
    if (feeDenom === undefined)
      throw new Error(`fee denom undefined for chain: ${chainId}`);

    const storeCodeRes: StoreCodeResponse =
      getResultOfPastStage(deployCodeStageId);

    const chainExecutor = createExecutorForChain(chainId as ChainId, mnemonic);

    return chainExecutor.instantiateContract({
      codeId: storeCodeRes.codeId,
      instMsg: getWormholeConfig(wormholeChainId, feeDenom, mainnet),
      label: "wormhole",
    });
  };
}

function getSetAdminStep(mnemonic: string, instantiateStageId: string): Step {
  return (chainId, getResultOfPastStage) => {
    const instantiateContractRes: InstantiateContractResponse =
      getResultOfPastStage(instantiateStageId);

    const chainExecutor = createExecutorForChain(chainId as ChainId, mnemonic);

    return chainExecutor.updateContractAdmin({
      newAdminAddr: instantiateContractRes.contractAddr,
      contractAddr: instantiateContractRes.contractAddr,
    });
  };
}

function getWormholeConfig(
  chainId: number,
  feeDenom: string,
  mainnet?: boolean
) {
  if (mainnet === true) {
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
  return {
    chain_id: chainId,
    fee_denom: feeDenom,
    gov_chain: 1,
    gov_address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=",
    guardian_set_expirity: 86400,
    initial_guardian_set: {
      addresses: [{ bytes: "E5R71IsY5T/a7ud/NHM5Gscnxjg=" }],
      expiration_time: 0,
    },
  };
}

run();
