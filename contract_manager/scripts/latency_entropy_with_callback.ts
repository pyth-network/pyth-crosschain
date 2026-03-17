/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { PrivateKey } from "../src/core/base";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import type { EvmEntropyContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests a random number from an entropy contract and measures the\n" +
      "latency between request submission and fulfillment by the Fortuna keeper service.\n" +
      "Usage: $0 --private-key <private-key> --chain <chain-id> | --all-chains <testnet|mainnet>",
  )
  .options({
    "all-chains": {
      choices: ["testnet", "mainnet"],
      conflicts: "chain",
      desc: "test latency for all entropy contracts deployed either on mainnet or testnet",
      type: "string",
    },
    chain: {
      conflicts: "all-chains",
      desc: "test latency for the contract on this chain",
      type: "string",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    provider: {
      demandOption: false,
      desc: "Provider address to use for the request. Will use the default provider if not specified",
      type: "string",
    },
  });

async function testLatency(
  contract: EvmEntropyContract,
  privateKey: PrivateKey,
  provider?: string,
) {
  provider = provider || (await contract.getDefaultProvider());
  const userRandomNumber = contract.generateUserRandomNumber();
  const requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey,
    true, // with callback
  );
  // Read the sequence number for the request from the transaction events.
  const sequenceNumber =
    requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber;

  const startTime = Date.now();

  const fromBlock = requestResponse.blockNumber;
  const web3 = contract.chain.getWeb3();
  const entropyContract = contract.getContract();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const currentBlock = await web3.eth.getBlockNumber();

    if (fromBlock > currentBlock) {
      continue;
    }

    const events = await entropyContract.getPastEvents("RevealedWithCallback", {
      fromBlock: fromBlock,
      toBlock: currentBlock,
    });

    const event = events.find(
      (event) => event.returnValues.request[1] == sequenceNumber,
    );

    if (event !== undefined) {
      const _endTime = Date.now();
      break;
    }
    if (Date.now() - startTime > 60_000) {
      break;
    }
  }
}

async function main() {
  const argv = await parser.argv;
  if (!argv.chain && !argv["all-chains"]) {
    throw new Error("Must specify either --chain or --all-chains");
  }
  const privateKey = toPrivateKey(argv.privateKey);
  if (argv["all-chains"]) {
    for (const contract of Object.values(DefaultStore.entropy_contracts)) {
      if (
        contract.getChain().isMainnet() ===
        (argv["all-chains"] === "mainnet")
      ) {
        await testLatency(contract, privateKey);
      }
    }
  } else if (argv.chain) {
    const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
    const contract = findEntropyContract(chain);
    await testLatency(contract, privateKey, argv.provider);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
