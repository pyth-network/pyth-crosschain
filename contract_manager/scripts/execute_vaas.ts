import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "@pythnetwork/xc-admin-common";
import { COMMON_DEPLOY_OPTIONS } from "./common";
import { Vault } from "../src/node/utils/governance";
import { toPrivateKey } from "../src/core/base";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { executeVaa } from "../src/node/utils/executor";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on a vault.\n" +
      "Useful for batch upgrades.\n" +
      "Usage: $0 --vault <mainnet|devnet> --private-key <private-key> (--offset <offset> | --sequence <sequence>) [--dryrun]",
  )
  .options({
    vault: {
      type: "string",
      default: "mainnet",
      choices: ["mainnet", "devnet"],
      desc: "Which vault to use for fetching VAAs",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    offset: {
      type: "number",
      desc: "Offset to use from the last executed sequence number",
      conflicts: ["sequence"],
    },
    sequence: {
      type: "number",
      desc: "Specific sequence number to execute",
      conflicts: ["offset"],
    },
    dryrun: {
      type: "boolean",
      default: false,
      desc: "Whether to execute the VAAs or just print them",
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
  let vault: Vault;
  if (argv.vault === "mainnet") {
    vault =
      DefaultStore.vaults[
        "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
      ];
  } else {
    vault =
      DefaultStore.vaults[
        "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"
      ];
  }
  console.log("Executing VAAs for vault", vault.getId());
  console.log(
    "Executing VAAs for emitter",
    (await vault.getEmitter()).toBase58(),
  );

  let startSequenceNumber: number;
  let endSequenceNumber: number;

  if (argv.sequence !== undefined) {
    startSequenceNumber = argv.sequence;
    endSequenceNumber = argv.sequence;
  } else if (argv.offset !== undefined) {
    const lastSequenceNumber = await vault.getLastSequenceNumber();
    startSequenceNumber = lastSequenceNumber - argv.offset;
    endSequenceNumber = lastSequenceNumber;
  } else {
    // this is unreachable but it makes the typescript linter happy.
    throw new Error("Either --offset or --sequence must be provided");
  }

  console.log(
    `Going from sequence number ${startSequenceNumber} to ${endSequenceNumber}`,
  );

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
      console.log("Skipping unknown action for vaa ", seqNumber);
      continue;
    }
    console.log("Executing vaa", seqNumber);
    console.log(decodedAction);
    if (!argv.dryrun) {
      await executeVaa(toPrivateKey(argv["private-key"]), vaa);
    }
  }
}

main();
