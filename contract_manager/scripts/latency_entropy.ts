import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { EvmChain } from "../src/core/chains";
import { toPrivateKey } from "../src/core/base";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests and reveals a random number from an entropy contract while measuing the\n" +
      "latency between request submission and availablity of the provider revelation from fortuna.\n" +
      "Usage: $0 --chain <chain-id> --private-key <private-key>",
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
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const contract = findEntropyContract(chain);

  const provider = await contract.getDefaultProvider();
  const providerInfo = await contract.getProviderInfo(provider);
  const userRandomNumber = contract.generateUserRandomNumber();
  const privateKey = toPrivateKey(argv.privateKey);
  const requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey,
  );
  console.log("Request tx hash: ", requestResponse.transactionHash);
  const startTime = Date.now();
  const sequenceNumber = providerInfo.sequenceNumber;
  const revealUrl = providerInfo.uri + `/revelations/${sequenceNumber}`;
  console.log("Checking this url for revelation:", revealUrl);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const fortunaResponse = await fetch(revealUrl);
    if (fortunaResponse.status === 200) {
      const payload = await fortunaResponse.json();
      const endTime = Date.now();
      console.log(`Fortuna Latency: ${endTime - startTime}ms`);
      const providerRevelation = "0x" + payload.value.data;
      const revealResponse = await contract.revealRandomness(
        userRandomNumber,
        providerRevelation,
        provider,
        sequenceNumber,
        privateKey,
      );
      console.log("Reveal tx hash: ", revealResponse.transactionHash);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

main();
