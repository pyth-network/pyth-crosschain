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
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

const fortunaUrl = "https://fortuna-staging.pyth.network";
const chainName = "optimism-goerli";
const coinFlipContractAddress = "0x075A5160FF6462924B4124595F6f987187496476";
const rpc = "https://goerli.optimism.io";
const privateKey = argv.privateKey;

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

  console.log(`here`);

  const flipFee = await coinFlipContract.methods.getFlipFee().call();

  console.log(`Fetched fee: ${flipFee}`);

  const randomNumber = web3.utils.randomHex(32);
  const commitment = web3.utils.keccak256(randomNumber);

  const receipt = await coinFlipContract.methods
    .requestFlip(commitment)
    .send({ value: flipFee, from: provider.getAddress(0) });

  console.log(`requested randomness at tx: ${receipt.transactionHash}`);
  const sequenceNumber = receipt.events.FlipRequest.returnValues.sequenceNumber;
  console.log(`received sequence number: ${sequenceNumber}`);

  const response = await axios.get(
    `${fortunaUrl}/v1/chains/${chainName}/revelations/${sequenceNumber}`
  );

  console.log(response.data);

  const providerRandom = web3.utils.bytesToHex(response.data.value);
  console.log(`provider random number: ${providerRandom}`);

  const receipt2 = await coinFlipContract.methods
    .revealFlip(sequenceNumber, randomNumber, providerRandom)
    .send({ from: provider.getAddress(0) });

  console.log(`resolved randomness at tx: ${receipt2.transactionHash}`);
  const isHeads = receipt2.events.FlipResult.returnValues.isHeads;
  console.log(`flip is heads? ${isHeads}`);

  provider.engine.stop();
}

main();
