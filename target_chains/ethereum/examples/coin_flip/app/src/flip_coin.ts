import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import HDWalletProvider from "@truffle/hdwallet-provider";
import CoinFlipAbi from "./CoinFlipAbi.json";

const parser = yargs(hideBin(process.argv))
  .option("private-key", {
    description: "Private key (as a hexadecimal string) of the sender",
    type: "string",
    required: true,
  })
  .option("address", {
    description: "The address of the CoinFlip contract",
    type: "string",
    required: true,
  })
  .option("rpc-url", {
    description:
      "The URL of an ETH RPC service for reading/writing to the blockchain",
    type: "string",
    required: true,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  });

async function main() {
  const argv = await parser.argv;

  const coinFlipContractAddress = argv.address;
  const rpc = argv.rpcUrl;
  const privateKey = argv.privateKey;

  const provider = new HDWalletProvider({
    privateKeys: [privateKey],
    providerOrUrl: rpc,
  });

  const web3 = new Web3(provider as any);

  const coinFlipContract = new web3.eth.Contract(
    CoinFlipAbi as any,
    coinFlipContractAddress
  );

  console.log(`Running coin flip prototcol.`);

  console.log("1. Generating user's random number...");
  const randomNumber = web3.utils.randomHex(32);
  console.log(`   number    : ${randomNumber}`);

  console.log("2. Requesting coin flip...");
  const flipFee = await coinFlipContract.methods.getFlipFee().call();
  console.log(`   fee       : ${flipFee} wei`);

  const receipt = await coinFlipContract.methods
    .requestFlip(randomNumber)
    .send({ value: flipFee, from: provider.getAddress(0) });

  console.log(`   tx        : ${receipt.transactionHash}`);
  const sequenceNumber = receipt.events.FlipRequest.returnValues.sequenceNumber;
  console.log(`   sequence  : ${sequenceNumber}`);

  console.log("3. Waiting for result...");
  // Poll for new FlipResult events emitted by the CoinFlip contract. It checks if the event
  // has the same sequenceNumber as the request. If it does,
  // it logs the result and stops polling.
  let fromBlock = receipt.blockNumber;
  const intervalId = setInterval(async () => {
    const currentBlock = await web3.eth.getBlockNumber();

    if (fromBlock > currentBlock) {
      return;
    }

    // Get 'FlipResult' events emitted by the CoinFlip contract for given block range.
    const events = await coinFlipContract.getPastEvents("FlipResult", {
      fromBlock: fromBlock,
      toBlock: currentBlock,
    });
    fromBlock = currentBlock + 1;

    // Find the event with the same sequence number as the request.
    const event = events.find(
      (event) => event.returnValues.sequenceNumber === sequenceNumber
    );

    // If the event is found, log the result and stop polling.
    if (event !== undefined) {
      console.log(
        `   result    : ${event.returnValues.isHeads ? "Heads" : "Tails"}`
      );
      clearInterval(intervalId);
    }
  }, 1000);

  provider.engine.stop();
}

main();
