import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import HDWalletProvider from "@truffle/hdwallet-provider";
import IEntropy from "@pythnetwork/entropy-sdk-solidity/abis/IEntropy.json";
import { FortunaConnection } from "../index";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "RPC for the network to relay on.",
    type: "string",
    required: true,
  })
  .option("contract", {
    description: "Entropy contract address.",
    type: "string",
    required: true,
  })
  .option("mnemonic", {
    description: "Mnemonic (private key) for sender",
    type: "string",
    required: true,
  })
  .option("fortuna-url", {
    description: "URL for Fortuna. e.g: https://endpoint/example",
    type: "string",
    required: false,
  })
  .option("provider", {
    description:
      "The randomness provider to query" + " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    required: false,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

const network = argv.network;

async function run() {
  const walletProvider = new HDWalletProvider({
    mnemonic: {
      phrase: argv.mnemonic,
    },
    providerOrUrl: network,
  });
  console.log(`wallet address: ${walletProvider.getAddress(0)}`);

  // @ts-ignore
  const web3 = new Web3(walletProvider);

  const userRandom = web3.utils.randomHex(32);
  console.log(`userRandom: ${userRandom}`);
  const commitment = web3.utils.keccak256(userRandom);

  const entropy = new web3.eth.Contract(IEntropy as any, argv.contract);

  let provider;
  if (argv.provider) {
    provider = argv.provider;
  } else {
    provider = await entropy.methods.getDefaultProvider().call();
    console.log(`using default provider ${provider}`);
  }

  console.log("1. getFee");
  const fee = await entropy.methods.getFee(provider).call();
  console.log("2. request");
  const receipt = await entropy.methods
    .request(provider, commitment, true)
    .send({ value: fee, from: walletProvider.getAddress(0) });
  console.log(`   tx        : ${receipt.transactionHash}`);
  const sequenceNumber =
    receipt.events.Requested.returnValues.request.sequenceNumber;
  const blockNumber = receipt.events.Requested.returnValues.request.blockNumber;
  console.log(`   sequence  : ${sequenceNumber}`);
  console.log(`   block     : ${blockNumber}`);

  console.log("3. Retrieving provider's random number...");

  let fortunaUrl;
  if (argv.fortunaUrl) {
    fortunaUrl = argv.fortunaUrl;
  } else {
    const providerInfo = await entropy.methods.getProviderInfo(provider);
    fortunaUrl = providerInfo.uri;
    console.log(`querying provider's configured URI ${fortunaUrl}`);
  }

  const connection = new FortunaConnection(fortunaUrl);
  const providerRandomHex = await connection.retrieveRandomNumber(
    sequenceNumber
  );
  const providerRandom = `0x${providerRandomHex}`;
  console.log(`   number    : ${providerRandom}`);

  let blockFinalized = false;
  while (!blockFinalized) {
    try {
      const block = await web3.eth.getBlock("latest");
      console.log(`current block number: ${block.number}`);
      if (block.number > blockNumber) {
        blockFinalized = true;
      }
    } catch (error) {
      console.log("Waiting for block to finalize");
      await new Promise((f) => setTimeout(f, 500));
    }
  }

  const receipt2 = await entropy.methods
    .reveal(provider, sequenceNumber, userRandom, providerRandom)
    .send({ from: walletProvider.getAddress(0) });
  console.log(`   tx        : ${receipt2.transactionHash}`);
  const randomNumber = receipt2.events.Revealed.returnValues.randomNumber;
  console.log(`   result    : ${randomNumber}`);

  walletProvider.engine.stop();
}

run();
