import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  AptosWormholeContract,
  CosmWasmPriceFeedContract,
  EvmPriceFeedContract,
  IotaWormholeContract,
  SuiWormholeContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { toPrivateKey } from "../src/core/base";

const parser = yargs(hideBin(process.argv))
  .usage("Update the guardian set in stable networks. Usage: $0")
  .options({
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions with",
    },
    chain: {
      type: "array",
      desc: "Can be one of the chains available in the store",
    },
  });

async function main() {
  const argv = await parser.argv;

  const privateKey = toPrivateKey(argv.privateKey);
  const chains = argv.chain;

  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (
      contract instanceof SuiWormholeContract ||
      contract instanceof IotaWormholeContract ||
      contract instanceof AptosWormholeContract
    ) {
      if (chains && !chains.includes(contract.getChain().getId())) {
        continue;
      }

      try {
        let index = await contract.getCurrentGuardianSetIndex();
        console.log("Guardian Index at Start:", index);
        await contract.syncMainnetGuardianSets(privateKey);
        index = await contract.getCurrentGuardianSetIndex();
        console.log("Guardian Index at End:", index);
      } catch (e) {
        console.error(`Error updating Guardianset for ${contract.getId()}`, e);
      }
    }
  }

  for (const contract of Object.values(DefaultStore.contracts)) {
    // We are currently only managing wormhole receiver contracts in EVM and
    // CosmWasm and Solana-based networks. The rest of the networks are
    // managed by the guardians themselves and they should be the ones updating
    // the guardian set.
    // TODO: Solana-based receivers have their script in their rust cli. Add
    // support for Solana-based networks here once they are added to the
    // contract manager.
    if (
      contract instanceof CosmWasmPriceFeedContract ||
      contract instanceof EvmPriceFeedContract
    ) {
      if (chains && !chains.includes(contract.getChain().getId())) {
        continue;
      }

      try {
        console.log("------------------------------------");
        const wormhole = await contract.getWormholeContract();

        // TODO: This is a temporary workaround to skip contracts that are in beta channel
        // We should have a better way to handle this
        // if ((await wormhole.getCurrentGuardianSetIndex()) === 0) {
        //   continue;
        // }

        console.log(
          `Current Guardianset for ${contract.getId()}: ${await wormhole.getCurrentGuardianSetIndex()}`,
        );

        await wormhole.syncMainnetGuardianSets(privateKey);
        console.log(`Updated Guardianset for ${contract.getId()}`);
      } catch (e) {
        console.error(`Error updating Guardianset for ${contract.getId()}`, e);
      }
    }
  }
}

main();
