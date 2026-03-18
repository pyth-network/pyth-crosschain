import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src/core/base";
import { executeVaa } from "../src/node/utils/executor";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on a vault.\n" +
      "Useful for batch upgrades.\n" +
      "Usage: $0 --vault <mainnet|devnet> --private-key <private-key> (--offset <offset> | --sequence <sequence>) [--dryrun]",
  )
  .options({
    dryrun: {
      default: false,
      desc: "Whether to execute the VAAs or just print them",
      type: "boolean",
    },
    offset: {
      conflicts: ["sequence"],
      desc: "Offset to use from the last executed sequence number",
      type: "number",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    sequence: {
      conflicts: ["offset"],
      desc: "Specific sequence number to execute",
      type: "number",
    },
    vault: {
      choices: ["mainnet", "devnet"],
      default: "mainnet",
      desc: "Which vault to use for fetching VAAs",
      type: "string",
    },
  })
  .check((argv) => {
    if (!argv.offset && !argv.sequence) {
      throw new Error("Either --offset or --sequence must be provided");
    }
    return true;
  });

async function main() {
  const argv = await parser.argv;
  const vault =
    argv.vault === "mainnet"
      ? DefaultStore.vaults[
          "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
        ]
      : DefaultStore.vaults.devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3;

  if (!vault) {
    throw new Error("Vault not found");
  }

  let startSequenceNumber: number;
  let endSequenceNumber: number;

  if (argv.sequence !== undefined) {
    startSequenceNumber = argv.sequence;
    endSequenceNumber = argv.sequence;
  } else if (argv.offset === undefined) {
    // this is unreachable but it makes the typescript linter happy.
    throw new Error("Either --offset or --sequence must be provided");
  } else {
    const lastSequenceNumber = await vault.getLastSequenceNumber();
    startSequenceNumber = (lastSequenceNumber ?? 0) - argv.offset;
    endSequenceNumber = lastSequenceNumber ?? 0;
  }

  for (
    let seqNumber = startSequenceNumber;
    seqNumber <= endSequenceNumber;
    seqNumber++
  ) {
    const submittedWormholeMessage = new SubmittedWormholeMessage(
      await vault.getEmitter(),
      seqNumber,
      vault.cluster,
    );
    const vaa = await submittedWormholeMessage.fetchVaa();
    const decodedAction = decodeGovernancePayload(parseVaa(vaa).payload);
    if (!decodedAction) {
      continue;
    }
    if (!argv.dryrun) {
      await executeVaa(toPrivateKey(argv["private-key"]), vaa);
    }
  }
}

main();
