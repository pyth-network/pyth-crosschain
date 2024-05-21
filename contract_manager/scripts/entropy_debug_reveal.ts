import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src";
import {
  COMMON_DEPLOY_OPTIONS,
  findEntropyContract,
  findEvmChain,
} from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to reveal an entropy request with callback using the provided private key.\n" +
      "This can be used to manually debug why a callback was not triggered.\n" +
      "Usage: $0 --chain <chain-id> --private-key <private-key> --sequence-number <sequence-number>"
  )
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "test latency for the contract on this chain",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    "sequence-number": {
      type: "number",
      demandOption: true,
      desc: "sequence number of the request to reveal",
    },
  });

async function main() {
  const argv = await parser.argv;
  const chain = findEvmChain(argv.chain);
  const contract = findEntropyContract(chain);
  const sequenceNumber = argv.sequenceNumber;

  const provider = await contract.getDefaultProvider();
  const providerInfo = await contract.getProviderInfo(provider);
  const privateKey = toPrivateKey(argv.privateKey);
  const request = await contract.getRequest(provider, sequenceNumber);
  if (request.sequenceNumber === "0") {
    console.log("Request not found");
    return;
  }
  console.log("Request block number: ", request.blockNumber);
  const userRandomNumber = await contract.getUserRandomNumber(
    provider,
    sequenceNumber,
    parseInt(request.blockNumber)
  );
  console.log("User random number: ", userRandomNumber);
  const revealUrl = providerInfo.uri + `/revelations/${sequenceNumber}`;
  const fortunaResponse = await fetch(revealUrl);
  if (fortunaResponse.status !== 200) {
    console.log("Fortuna response status: ", fortunaResponse.status);
    return;
  }
  const payload = await fortunaResponse.json();
  const providerRevelation = "0x" + payload.value.data;
  await contract.revealWithCallback(
    userRandomNumber,
    providerRevelation,
    provider,
    sequenceNumber,
    privateKey
  );
}

main();
