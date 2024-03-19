import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, toPrivateKey } from "../src";
import { COMMON_DEPLOY_OPTIONS } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Requests and reveals a random number from an entropy contract while measuing the\n" +
      "latency between request submission and availablity of the provider revelation from fortuna.\n" +
      "Usage: $0 --contract <entropy_contract_id> --private-key <private-key>"
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to test latency for",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.entropy_contracts[argv.contract];
  if (!contract) {
    throw new Error(
      `Contract ${argv.contract} not found. Contracts found: ${Object.keys(
        DefaultStore.entropy_contracts
      )}`
    );
  }
  const provider = await contract.getDefaultProvider();
  const providerInfo = await contract.getProviderInfo(provider);
  const userRandomNumber = contract.generateUserRandomNumber();
  const privateKey = toPrivateKey(argv.privateKey);
  const requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey
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
        privateKey
      );
      console.log("Reveal tx hash: ", revealResponse.transactionHash);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

main();
