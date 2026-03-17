/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests and reveals a random number from an entropy contract while measuing the\n" +
      "latency between request submission and availablity of the provider revelation from fortuna.\n" +
      "Usage: $0 --chain <chain-id> --private-key <private-key>",
  )
  .options({
    chain: {
      demandOption: true,
      desc: "test latency for the contract on this chain",
      type: "string",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  });

async function main() {
  const argv = await parser.argv;
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const contract = findEntropyContract(chain);

  const provider = await contract.getDefaultProvider();
  const providerInfo = await contract.getProviderInfo(provider);
  const userRandomNumber = contract.generateUserRandomNumber();
  const privateKey = toPrivateKey(argv.privateKey);
  const _requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey,
  );
  const _startTime = Date.now();
  const sequenceNumber = providerInfo.sequenceNumber;
  const revealUrl = providerInfo.uri + `/revelations/${sequenceNumber}`;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const fortunaResponse = await fetch(revealUrl);
    if (fortunaResponse.status === 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (await fortunaResponse.json()) as any;
      const _endTime = Date.now();
      const providerRevelation = "0x" + payload.value.data;
      const _revealResponse = await contract.revealRandomness(
        userRandomNumber,
        providerRevelation,
        provider,
        sequenceNumber,
        privateKey,
      );
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
