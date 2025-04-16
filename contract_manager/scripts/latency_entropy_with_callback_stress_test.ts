import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  DefaultStore,
  EvmChain,
  EvmEntropyContract,
  PrivateKey,
  toPrivateKey,
} from "../src";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests random numbers from an entropy contract and measures the\n" +
      "latency between request submission and fulfillment by the Fortuna keeper service.\n" +
      "Usage: $0 --private-key <private-key> --chain <chain-id> | --all-chains <testnet|mainnet> --nrequests <number> --delay <delay>",
  )
  .options({
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
    "nrequests": {
      type: "number",
      desc: "number of requests to make",
      default: 1,
    },
    "delay": {
      type: "number",
      desc: "delay between requests",
      default: 25,
    },
  });

async function sendRequest(
  contract: EvmEntropyContract,
  privateKey: PrivateKey,
  requestId: number,
): Promise<{ EntropyRequestResponse: any; startTime: number }> {
  const fortunaProvider = await contract.getDefaultProvider();
  const userRandomNumber = contract.generateUserRandomNumber();
  const EntropyRequestResponse = await contract.requestRandomness(
    userRandomNumber,
    fortunaProvider,
    privateKey,
    true, // with callback
  );
  const startTime = Date.now();
  console.log(`[Request ${requestId}] Request tx hash  : ${EntropyRequestResponse.transactionHash}`);
  return { EntropyRequestResponse: EntropyRequestResponse, startTime: startTime };
}

async function waitForCallback(
  contract: EvmEntropyContract,
  EntropyRequestResponse: any,
  startTime: number,
  requestId: number,
): Promise<{ success: boolean; latency?: number }> {
  const fromBlock = EntropyRequestResponse.blockNumber;
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
      (event) => event.returnValues.request[1] == EntropyRequestResponse.events.RequestedWithCallback.returnValues.sequenceNumber,
    );

    if (event !== undefined) {
      console.log(`[Request ${requestId}] Random number    : ${event.returnValues.randomNumber}`);
      const eventBlockTimestamp = Number(await web3.eth.getBlock(event.blockNumber).then(block => block.timestamp));
      const entropyRequestBlockTimestamp = Number(await web3.eth.getBlock(EntropyRequestResponse.blockNumber).then(block => block.timestamp));
      const latency = eventBlockTimestamp - entropyRequestBlockTimestamp;
      console.log(`[Request ${requestId}] Fortuna Latency  : ${latency}ms`);
      console.log(
        `[Request ${requestId}] Revealed after   : ${
          event.blockNumber - EntropyRequestResponse.blockNumber
        } blocks`,
      );
      return { success: true, latency };
    }
    if (Date.now() - startTime > 60000) {
      console.log(`[Request ${requestId}] Timeout: 60s passed without the callback being called.`);
      return { success: false };
    }
  }
}

async function testParallelLatency(
  contract: EvmEntropyContract,
  privateKey: PrivateKey,
  numRequests: number,
  delay: number,
) {
  console.log(`Starting ${numRequests} requests...`);

  // First send all requests
  const requests: { EntropyRequestResponse: any; startTime: number; requestId: number }[] = [];
  for (let i = 0; i < numRequests; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    const { EntropyRequestResponse, startTime } = await sendRequest(contract, privateKey, i + 1);
    requests.push({ EntropyRequestResponse, startTime, requestId: i + 1 });
  }




  // Then wait for all callbacks
  // The response time won't be accurate here.
  const results: { success: boolean; latency?: number }[] = [];
  for (const request of requests) {
    const sequenceNumber =
    request.EntropyRequestResponse.events.RequestedWithCallback.returnValues.sequenceNumber;
    console.log(`[Request ${request.requestId}] sequence         : ${sequenceNumber}`);
    results.push(await waitForCallback(
      contract,
      request.EntropyRequestResponse,
      request.startTime,
      request.requestId
    ));
  }

  // Calculate statistics
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = numRequests - successfulRequests;
  const successRate = (successfulRequests / numRequests) * 100;

  // Calculate average latency for successful requests
  const successfulLatencies = results
    .filter((r): r is { success: true; latency: number } => r.success && r.latency !== undefined)
    .map(r => r.latency);
  const avgLatency = successfulLatencies.length > 0
    ? successfulLatencies.reduce((a, b) => a + b, 0) / successfulLatencies.length
    : 0;

  console.log("\n=== Test Results ===");
  console.log(`Total Requests    : ${numRequests}`);
  console.log(`Successful        : ${successfulRequests}`);
  console.log(`Failed           : ${failedRequests}`);
  console.log(`Success Rate     : ${successRate.toFixed(2)}%`);
  if (successfulLatencies.length > 0) {
    console.log(`Average Latency  : ${avgLatency.toFixed(2)}ms`);
  }
  console.log("===================");
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
        await testParallelLatency(contract, privateKey, argv["nrequests"], argv["delay"]);
      }
    }
  } else if (argv.chain) {
    const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
    const contract = findEntropyContract(chain);
    await testParallelLatency(contract, privateKey, argv["nrequests"], argv["delay"]);
  }
}

main();
