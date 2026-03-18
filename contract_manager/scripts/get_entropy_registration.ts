/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { DefaultStore } from "../src/node/utils/store";

function deserializeCommitmentMetadata(data: Buffer) {
  const seed = Uint8Array.from(data.subarray(0, 32));
  const chainLength = data.readBigInt64LE(32);

  return {
    chainLength,
    seed,
  };
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      default: false,
      desc: "Fetch the provider registration data for the testnet contracts.",
      type: "boolean",
    },
  });

async function main() {
  const argv = await parser.argv;

  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    let provider;
    let providerInfo;
    try {
      provider = await contract.getDefaultProvider();
      providerInfo = await contract.getProviderInfo(provider);
    } catch (_error) {
      continue;
    }

    const commitmentMetadata = providerInfo.commitmentMetadata.replace(
      "0x",
      "",
    );

    // const binaryData = hexToBytes(commitmentMetadata);
    const _metadata = deserializeCommitmentMetadata(
      Buffer.from(commitmentMetadata, "hex"),
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
