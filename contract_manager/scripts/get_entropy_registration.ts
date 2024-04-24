import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src";

interface CommitmentMetadata {
  seed: Uint8Array; // u8; 32
  chainLength: bigint; // u64
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[j] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function deserializeCommitmentMetadata(data: Uint8Array): CommitmentMetadata {
  const seed = data.slice(1, 33);
  const chainLengthArray = data.slice(33, 41);
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
      desc: "Fetch testnet contract fees instead of mainnet",
    },
  });

async function main() {
  const argv = await parser.argv;
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    try {
      const provider = await contract.getDefaultProvider();
      const providerInfo = await contract.getProviderInfo(provider);
      const commitmentMetadata = providerInfo.commitmentMetadata;

      const binaryData = hexToBytes(commitmentMetadata);
      const metadata = deserializeCommitmentMetadata(binaryData);
      console.log("=".repeat(100));
      console.log(`Fetched info for ${contract.getId()}`);

      console.log(`chain             : ${contract.getChain().getId()}`);
      console.log(`contract          : ${contract.address}`);
      console.log(`provider          : ${provider}`);
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
