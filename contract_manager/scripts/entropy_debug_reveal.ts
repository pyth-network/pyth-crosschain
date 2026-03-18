/* eslint-disable @typescript-eslint/restrict-plus-operands */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS, findEntropyContract } from "./common";

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
      demandOption: true,
      desc: "Chain id where the contract is deployed",
      type: "string",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    "sequence-number": {
      demandOption: true,
      desc: "Sequence number of the request to reveal or a range of sequence numbers to reveal separated by colon (e.g. 1000:1100 reveals requests with 1000 <= number < 1100)",
      type: "string",
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
    [startingSequenceNumber = 0, endingSequenceNumber = 0] = argv.sequenceNumber
      .split(":")
      .map(Number);
  } else {
    startingSequenceNumber = Number(argv.sequenceNumber);
    endingSequenceNumber = startingSequenceNumber + 1; // Default to revealing a single request
  }
  if (startingSequenceNumber >= endingSequenceNumber) {
    return;
  }

  for (
    let sequenceNumber = startingSequenceNumber;
    sequenceNumber < endingSequenceNumber;
    sequenceNumber++
  ) {
    const request = await contract.getRequest(provider, sequenceNumber);
    if (request.sequenceNumber === "0") {
      continue;
    }
    const userRandomNumber = await contract.getUserRandomNumber(
      provider,
      sequenceNumber,
      Number.parseInt(request.blockNumber),
    );
    const revealUrl = providerInfo.uri + `/revelations/${sequenceNumber}`;
    const fortunaResponse = await fetch(revealUrl);
    if (fortunaResponse.status !== 200) {
      return;
    }
    const payload = await fortunaResponse.json();
    // @ts-expect-error - TODO payload.value is unknown and the typing needs to be fixed
    const providerRevelation = "0x" + payload.value.data;
    try {
      await contract.revealWithCallback(
        userRandomNumber,
        providerRevelation,
        provider,
        sequenceNumber,
        privateKey,
      );
    } catch (_error) {
      continue;
    }
  }
}

main();
