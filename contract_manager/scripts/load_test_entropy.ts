/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Load tests the entropy contract using the EntropyTester contract with many requests in a single transaction\n" +
      "it does not monitor whether the callbacks are actually submitted or not.\n" +
      "Usage: $0 --private-key <private-key> --chain <chain-id> --tester-address <tester-address> --provider-address <provider-address>",
  )
  .options({
    chain: {
      demandOption: true,
      desc: "Chain to load test the entropy contract on",
      type: "string",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    provider: {
      desc: "Address of the entropy provider to use for requests (defaults to default provider)",
      type: "string",
    },
    "revert-count": {
      default: 0,
      desc: "How many requests to make where the callback should revert",
      type: "number",
    },
    "success-count": {
      default: 100,
      desc: "How many successful requests to make",
      type: "number",
    },
    "tester-address": {
      demandOption: true,
      desc: "Address of the EntropyTester contract",
      type: "string",
    },
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
] as any;

async function main() {
  const argv = await parser.argv;
  const privateKey = toPrivateKey(argv.privateKey);
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const contract = findEntropyContract(chain);
  const provider = argv.provider || (await contract.getDefaultProvider());
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
  const _result = await contract.chain.estiamteAndSendTransaction(
    transactionObject,
    {
      from: address,
      value: (fee * totalCount).toString(),
    },
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
