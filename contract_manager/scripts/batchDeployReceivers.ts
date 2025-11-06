/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */

/**
 * This script deploys the receiver contracts on all the chains and creates a governance proposal to update the
 * wormhole addresses to the deployed receiver contracts.
 */

import * as fs from "node:fs";

import { CHAINS } from "@pythnetwork/xc-admin-common";
import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { getDefaultConfig } from "../../target_chains/ethereum/contracts/scripts/contractManagerConfig.js";
import type { PrivateKey } from "../src/core/base.js";
import { EvmChain } from "../src/core/chains.js";
import { EvmWormholeContract } from "../src/core/contracts/evm.js";
import { loadHotWallet } from "../src/node/utils/governance.js";
import { DefaultStore } from "../src/node/utils/store.js";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --contracts <path-to-contract-json-folder> --network <contract_id> --private-key <private-key> --ops-wallet <ops-wallet>",
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Path to the contract json file containing abi and bytecode",
    },
    network: {
      type: "string",
      demandOption: true,
      choices: ["testnet", "mainnet"],
      desc: "The network to deploy the contract on",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions. Hex format, without 0x prefix.",
    },
    "ops-wallet": {
      type: "string",
      demandOption: true,
      desc: "Path to operations wallet json file",
    },
  });

async function memoize(
  key: string,
  fn: () => Promise<string>,
): Promise<string> {
  const cacheDir = "../../target_chains/ethereum/contracts/cache";
  const path = `${cacheDir}/${key}.json`;

  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path).toString());
  }
  const result = await fn();
  fs.writeFileSync(path, JSON.stringify(result));
  return result;
}

async function main() {
  const argv = await parser.argv;
  const privateKey = argv["private-key"];
  const network = argv.network;

  const setupInfo = await import(argv.contract + "/ReceiverSetup.json");
  const implementationInfo = await import(
    argv.contract + "/ReceiverImplementation.json"
  );
  const receiverInfo = await import(argv.contract + "/WormholeReceiver.json");

  const payloads: Buffer[] = [];
  for (const chain of Object.values(DefaultStore.chains)) {
    if (
      chain instanceof EvmChain &&
      chain.isMainnet() === (network === "mainnet")
    ) {
      if (chain.wormholeChainName === "zksync") continue; // deploy zksync receiver separately
      const {
        wormholeGovernanceChainId,
        wormholeGovernanceContract,
        wormholeInitialSigners,
      } = getDefaultConfig(chain.getId());
      console.log(chain.getId());
      const address = await memoize(chain.getId(), async () => {
        const setupAddress = await chain.deploy(
          privateKey as PrivateKey,
          setupInfo.abi,
          setupInfo.bytecode,
          [],
        );
        console.log("setupAddress", setupAddress);
        const implementationAddress = await chain.deploy(
          privateKey as PrivateKey,
          implementationInfo.abi,
          implementationInfo.bytecode,
          [],
        );
        console.log("implementationAddress", implementationAddress);
        const web3 = new Web3();
        const setup = new web3.eth.Contract(setupInfo.abi, setupAddress);
        const initData = setup.methods
          .setup(
            implementationAddress,
            wormholeInitialSigners,
            CHAINS[chain.wormholeChainName],
            wormholeGovernanceChainId,
            wormholeGovernanceContract,
          )
          .encodeABI();

        // deploy proxy
        const receiverAddress = await chain.deploy(
          privateKey as PrivateKey,
          receiverInfo.abi,
          receiverInfo.bytecode,
          [setupAddress, initData],
        );
        const contract = new EvmWormholeContract(chain, receiverAddress);
        console.log("receiverAddress", receiverAddress);
        await contract.syncMainnetGuardianSets(privateKey as PrivateKey);
        console.log("synced");
        return contract.address;
      });
      const payload = chain.generateGovernanceSetWormholeAddressPayload(
        address.replace("0x", ""),
      );
      payloads.push(payload);
    }
  }
  const vaultName =
    network === "mainnet"
      ? "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
      : "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3";
  const vault = DefaultStore.vaults[vaultName];
  vault?.connect(await loadHotWallet(argv["ops-wallet"]));
  await vault?.proposeWormholeMessage(payloads);
}

main();
