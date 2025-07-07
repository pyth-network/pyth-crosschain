import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to reveal entropy requests with callback using the provided private key.\n" +
      "This can be used to manually debug why a callback was not triggered or recover manually from a downtime\n" +
      "Usage: \n" +
      "$0 --chain <chain-id> --private-key <private-key> --sequence-number <sequence-number>\n" +
      "$0 --chain <chain-id> --private-key <private-key> --sequence-number <start>:<end>",
  )
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain id where the contract is deployed",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    "sequence-number": {
      type: "string",
      demandOption: true,
      desc: "Sequence number of the request to reveal or a range of sequence numbers to reveal separated by colon (e.g. 1000:1100 reveals requests with 1000 <= number < 1100)",
    },
  });

async function main() {
  const argv = await parser.argv;
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const contract = findEntropyContract(chain);
  const provider = await contract.getDefaultProvider();
  const providerInfo = await contract.getProviderInfo(provider);
  const privateKey = toPrivateKey(argv.privateKey);
  let startingSequenceNumber: number, endingSequenceNumber: number;
  if (argv.sequenceNumber.includes(":")) {
    [startingSequenceNumber, endingSequenceNumber] = argv.sequenceNumber
      .split(":")
      .map(Number);
  } else {
    startingSequenceNumber = Number(argv.sequenceNumber);
    endingSequenceNumber = startingSequenceNumber + 1; // Default to revealing a single request
  }
  if (startingSequenceNumber >= endingSequenceNumber) {
    console.error(
      "Invalid sequence number range provided. Use format: <start>:<end>",
    );
    return;
  }
  console.log(
    `Revealing requests from sequence number ${startingSequenceNumber} to ${endingSequenceNumber}`,
  );

  for (
    let sequenceNumber = startingSequenceNumber;
    sequenceNumber < endingSequenceNumber;
    sequenceNumber++
  ) {
    console.log("Revealing request for sequence number: ", sequenceNumber);
    const request = await contract.getRequest(provider, sequenceNumber);
    if (request.sequenceNumber === "0") {
      console.log("Request not found");
      continue;
    }
    console.log("Request block number: ", request.blockNumber);
    const userRandomNumber = await contract.getUserRandomNumber(
      provider,
      sequenceNumber,
      parseInt(request.blockNumber),
    );
    console.log("User random number: ", userRandomNumber);
    const revealUrl = providerInfo.uri + `/revelations/${sequenceNumber}`;
    const fortunaResponse = await fetch(revealUrl);
    if (fortunaResponse.status !== 200) {
      console.error("Fortuna response status: ", fortunaResponse.status);
      console.error("Fortuna response body: ", await fortunaResponse.text());
      console.error(
        "Refusing to continue the script, please check the Fortuna service first.",
      );
      return;
    }
    const payload = await fortunaResponse.json();
    const providerRevelation = "0x" + payload.value.data;
    try {
      await contract.revealWithCallback(
        userRandomNumber,
        providerRevelation,
        provider,
        sequenceNumber,
        privateKey,
      );
    } catch (e) {
      console.error("Error revealing request: ", e);
      continue;
    }
  }
}

main();
