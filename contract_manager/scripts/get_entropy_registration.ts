import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src";

interface CommitmentMetadata {
  seed: Uint8Array; // u8; 32
  chainLength: bigint; // u64
}

function hexToBytes(hex: string): Uint8Array {
  const buffer = Buffer.from(hex, "hex");
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function deserializeCommitmentMetadata(data: Uint8Array): CommitmentMetadata {
  const seed = data.slice(0, 32);
  const chainLengthArray = data.slice(32, 40);
  const chainLength = new DataView(chainLengthArray.buffer).getBigInt64(
    0,
    true
  );

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
    try {
      const provider = await contract.getDefaultProvider();
      const providerInfo = await contract.getProviderInfo(provider);
      const commitmentMetadata = providerInfo.commitmentMetadata.replace(
        "0x",
        ""
      );

      const binaryData = hexToBytes(commitmentMetadata);
      const metadata = deserializeCommitmentMetadata(binaryData);
      console.log("=".repeat(100));
      console.log(`Fetched info for ${contract.getId()}`);

      console.log(`chain             : ${contract.getChain().getId()}`);
      console.log(`contract          : ${contract.address}`);
      console.log(`provider          : ${provider}`);
      console.log(`commitment data   : ${commitmentMetadata}`);
      console.log(`chainLength       : ${metadata.chainLength}`);
      console.log(`seed              : [${metadata.seed}]`);
      console.log(
        `original seq no   : ${providerInfo.originalCommitmentSequenceNumber}`
      );
    } catch (e) {
      console.error(`Error fetching info for ${contract.getId()}`, e);
    }
  }
}

main();
