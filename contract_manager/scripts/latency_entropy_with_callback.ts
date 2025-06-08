import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { PrivateKey, toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { EvmEntropyContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests a random number from an entropy contract and measures the\n" +
      "latency between request submission and fulfillment by the Fortuna keeper service.\n" +
      "Usage: $0 --private-key <private-key> --chain <chain-id> | --all-chains <testnet|mainnet>",
  )
  .options({
    provider: {
      type: "string",
      desc: "Provider address to use for the request. Will use the default provider if not specified",
      demandOption: false,
    },
    chain: {
      type: "string",
      desc: "test latency for the contract on this chain",
      conflicts: "all-chains",
    },
    "all-chains": {
      type: "string",
      conflicts: "chain",
      choices: ["testnet", "mainnet"],
      desc: "test latency for all entropy contracts deployed either on mainnet or testnet",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
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
  console.log(`Request tx hash  : ${requestResponse.transactionHash}`);
  // Read the sequence number for the request from the transaction events.
  const sequenceNumber =
    requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber;
  console.log(`sequence         : ${sequenceNumber}`);

  const startTime = Date.now();

  const fromBlock = requestResponse.blockNumber;
  const web3 = contract.chain.getWeb3();
  const entropyContract = contract.getContract();

  // eslint-disable-next-line no-constant-condition
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
      console.log(`Random number    : ${event.returnValues.randomNumber}`);
      const endTime = Date.now();
      console.log(`Fortuna Latency  : ${endTime - startTime}ms`);
      console.log(
        `Revealed after   : ${
          currentBlock - requestResponse.blockNumber
        } blocks`,
      );
      break;
    }
    if (Date.now() - startTime > 60000) {
      console.log("Timeout: 60s passed without the callback being called.");
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
        console.log(`Testing latency for ${contract.getId()}...`);
        await testLatency(contract, privateKey);
      }
    }
  } else if (argv.chain) {
    const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
    const contract = findEntropyContract(chain);
    await testLatency(contract, privateKey, argv.provider);
  }
}

main();
