import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src";
import {
  COMMON_DEPLOY_OPTIONS,
  findEntropyContract,
  findEvmChain,
} from "./common";
import Web3 from "web3";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests a random number from an entropy contract and measures the\n" +
      "latency between request submission and fulfillment by the Fortuna keeper service.\n" +
      "Usage: $0 --chain-id <chain-id> --private-key <private-key>"
  )
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "test latency for the contract on this chain",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  });

async function main() {
  const argv = await parser.argv;

  const chain = findEvmChain(argv.chain);
  const contract = findEntropyContract(chain);

  const provider = await contract.getDefaultProvider();
  const userRandomNumber = contract.generateUserRandomNumber();
  const privateKey = toPrivateKey(argv.privateKey);
  const requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey,
    true // with callback
  );
  console.log(`Request tx hash  : ${requestResponse.transactionHash}`);
  // Read the sequence number for the request from the transaction events.
  const sequenceNumber =
    requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber;
  console.log(`sequence         : ${sequenceNumber}`);

  const startTime = Date.now();

  let fromBlock = requestResponse.blockNumber;
  const web3 = new Web3(contract.chain.getRpcUrl());
  const entropyContract = contract.getContract();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentBlock = await web3.eth.getBlockNumber();

    if (fromBlock > currentBlock) {
      continue;
    }

    const events = await entropyContract.getPastEvents("RevealedWithCallback", {
      fromBlock: fromBlock,
      toBlock: currentBlock,
    });
    fromBlock = currentBlock + 1;

    const event = events.find(
      (event) => event.returnValues.request[1] == sequenceNumber
    );

    if (event !== undefined) {
      console.log(`Random number    : ${event.returnValues.randomNumber}`);
      const endTime = Date.now();
      console.log(`Fortuna Latency  : ${endTime - startTime}ms`);
      console.log(
        `Revealed after   : ${
          currentBlock - requestResponse.blockNumber
        } blocks`
      );
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

main();
