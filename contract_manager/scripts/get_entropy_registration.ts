import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";

function deserializeCommitmentMetadata(data: Buffer) {
  const seed = Uint8Array.from(data.subarray(0, 32));
  const chainLength = data.readBigInt64LE(32);

  return {
    seed,
    chainLength,
  };
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch the provider registration data for the testnet contracts.",
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
    } catch (e) {
      console.error(`Error fetching info for ${contract.getId()}`, e);
      continue;
    }

    const commitmentMetadata = providerInfo.commitmentMetadata.replace(
      "0x",
      "",
    );

    // const binaryData = hexToBytes(commitmentMetadata);
    const metadata = deserializeCommitmentMetadata(
      Buffer.from(commitmentMetadata, "hex"),
    );
    console.log("=".repeat(100));
    console.log(`Fetched info for ${contract.getId()}`);

    console.log(`chain             : ${contract.getChain().getId()}`);
    console.log(`contract          : ${contract.address}`);
    console.log(`provider          : ${provider}`);
    console.log(`commitment data   : ${commitmentMetadata}`);
    console.log(`chainLength       : ${metadata.chainLength}`);
    console.log(`seed              : [${metadata.seed}]`);
    console.log(
      `original seq no   : ${providerInfo.originalCommitmentSequenceNumber}`,
    );
  }
}

main();
