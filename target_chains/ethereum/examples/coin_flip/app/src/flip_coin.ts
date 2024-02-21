import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import HDWalletProvider from "@truffle/hdwallet-provider";
import CoinFlipAbi from "./CoinFlipAbi.json";
import axios from "axios";

const argv = yargs(hideBin(process.argv))
  .option("private-key", {
    description: "Private key (as a hexadecimal string) of the sender",
    type: "string",
    required: true,
  })
  .option("fortuna-url", {
    description: "URL of the fortuna server for your chosen provider",
    type: "string",
    default: "https://fortuna-staging.dourolabs.app",
  })
  .option("chain-name", {
    description:
      "The name of your blockchain (for accessing data from fortuna)",
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
  })
  .parseSync();

const fortunaUrl = argv.fortunaUrl;
const chainName = argv.chainName;
const coinFlipContractAddress = argv.address;
const rpc = argv.rpcUrl;
const privateKey = argv.privateKey;

async function fetchWithRetry(url: string, maxRetries: number): Promise<any> {
  let retryCount = 0;

  async function doRequest() {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(doRequest, 1000);
      } else {
        console.error("Max retry attempts reached. Exiting.");
        throw error;
      }
    }
  }

  return await doRequest(); // Start the initial request
}

async function main() {
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
  const commitment = web3.utils.keccak256(randomNumber);
  console.log(`   number    : ${randomNumber}`);
  console.log(`   commitment: ${commitment}`);

  console.log("2. Requesting coin flip...");
  const flipFee = await coinFlipContract.methods.getFlipFee().call();
  console.log(`   fee       : ${flipFee} wei`);

  const receipt = await coinFlipContract.methods
    .requestFlip(commitment)
    .send({ value: flipFee, from: provider.getAddress(0) });

  console.log(`   tx        : ${receipt.transactionHash}`);
  const sequenceNumber = receipt.events.FlipRequest.returnValues.sequenceNumber;
  console.log(`   sequence  : ${sequenceNumber}`);

  console.log("3. Retrieving provider's random number...");
  const url = `${fortunaUrl}/v1/chains/${chainName}/revelations/${sequenceNumber}`;
  console.log(`   fetch url : ${url}`);
  // Note that there is a potential race condition here: the server may not have observed the request ^
  // before this HTTP response. Hence, we retry fetching the url a couple of times.
  const response = await fetchWithRetry(url, 3);
  const providerRandom = `0x${response.value.data}`;
  console.log(`   number    : ${providerRandom}`);

  console.log("4. Revealing the result of the coin flip...");
  const receipt2 = await coinFlipContract.methods
    .revealFlip(sequenceNumber, randomNumber, providerRandom)
    .send({ from: provider.getAddress(0) });
  console.log(`   tx        : ${receipt2.transactionHash}`);
  const isHeads = receipt2.events.FlipResult.returnValues.isHeads;
  console.log(`   result    : ${isHeads ? "heads" : "tails"}`);

  provider.engine.stop();
}

main();
