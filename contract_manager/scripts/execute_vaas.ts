import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/store";
import { SubmittedWormholeMessage, Vault } from "../src/governance";
import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "xc_admin_common";
import { executeVaa } from "../src/executor";
import { toPrivateKey } from "../src";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on a vault.\n" +
      "Useful for batch upgrades.\n" +
      "Usage: $0 --vault <mainnet|devnet> --private-key <private-key> --offset <offset> [--dryrun]"
  )
  .options({
    vault: {
      type: "string",
      default: "mainnet",
      choices: ["mainnet", "devnet"],
      desc: "Which vault to use for fetching VAAs",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions executing the governance VAAs. Hex format, without 0x prefix.",
    },
    offset: {
      type: "number",
      demandOption: true,
      desc: "Offset to use from the last executed sequence number",
    },
    dryrun: {
      type: "boolean",
      default: false,
      desc: "Whether to execute the VAAs or just print them",
    },
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
    (await vault.getEmitter()).toBase58()
  );
  const lastSequenceNumber = await vault.getLastSequenceNumber();
  const startSequenceNumber = lastSequenceNumber - argv.offset;
  console.log(
    `Going from sequence number ${startSequenceNumber} to ${lastSequenceNumber}`
  );
  for (
    let seqNumber = startSequenceNumber;
    seqNumber <= lastSequenceNumber;
    seqNumber++
  ) {
    const submittedWormholeMessage = new SubmittedWormholeMessage(
      await vault.getEmitter(),
      seqNumber,
      vault.cluster
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
