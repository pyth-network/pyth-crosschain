import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { EvmChain } from "../src/core/chains";
import { toPrivateKey } from "../src/core/base";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Load tests the entropy contract using the EntropyTester contract with many requests in a single transaction\n" +
      "it does not monitor whether the callbacks are actually submitted or not.\n" +
      "Usage: $0 --private-key <private-key> --chain <chain-id> --tester-address <tester-address>",
  )
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to load test the entropy contract on",
    },
    "tester-address": {
      type: "string",
      demandOption: true,
      desc: "Address of the EntropyTester contract",
    },
    "success-count": {
      type: "number",
      default: 100,
      desc: "How many successful requests to make",
    },
    "revert-count": {
      type: "number",
      default: 0,
      desc: "How many requests to make where the callback should revert",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  });

const ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "success",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "fail",
        type: "uint64",
      },
    ],
    name: "batchRequests",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function main() {
  const argv = await parser.argv;
  const privateKey = toPrivateKey(argv.privateKey);
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const contract = findEntropyContract(chain);
  const provider = await contract.getDefaultProvider();
  const fee = await contract.getFee(provider);
  const web3 = contract.chain.getWeb3();
  const testerContract = new web3.eth.Contract(ABI, argv.testerAddress);
  const { address } = web3.eth.accounts.wallet.add(privateKey);
  const transactionObject = testerContract.methods.batchRequests(
    provider,
    argv.successCount,
    argv.revertCount,
  );
  const totalCount = argv.successCount + argv.revertCount;
  const result = await contract.chain.estiamteAndSendTransaction(
    transactionObject,
    {
      from: address,
      value: (fee * totalCount).toString(),
    },
  );
  console.log("Submitted transaction ", result.transactionHash);
}

main();
