import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "@pythnetwork/xc-admin-common";
import { toPrivateKey } from "../src/core/base";
import { SubmittedWormholeMessage, Vault } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on a contract.\n" +
      "Useful for recently deployed contracts.\n" +
      "Usage: $0 --contract <contract_id> --private-key <private-key>",
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to execute governance vaas for",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions executing the governance VAAs. Hex format, without 0x prefix.",
    },
    offset: {
      type: "number",
      desc: "Starting sequence number to use, if not provided will start from contract last executed governance sequence number",
    },
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract];
  if (!contract) {
    throw new Error(`Contract ${argv.contract} not found`);
  }
  const governanceSource = await contract.getGovernanceDataSource();
  const mainnetVault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];
  const devnetVault =
    DefaultStore.vaults["devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"];
  let matchedVault: Vault;
  if (
    (await devnetVault.getEmitter()).toBuffer().toString("hex") ===
    governanceSource.emitterAddress
  ) {
    console.log("devnet multisig matches governance source");
    matchedVault = devnetVault;
  } else if (
    (await mainnetVault.getEmitter()).toBuffer().toString("hex") ===
    governanceSource.emitterAddress
  ) {
    console.log("mainnet multisig matches governance source");
    matchedVault = mainnetVault;
  } else {
    throw new Error(
      "can not find a multisig that matches the governance source of the contract",
    );
  }
  let lastExecuted = await contract.getLastExecutedGovernanceSequence();
  console.log("last executed governance sequence", lastExecuted);
  if (argv.offset && argv.offset > lastExecuted) {
    console.log("skipping to offset", argv.offset);
    lastExecuted = argv.offset - 1;
  }
  console.log("Starting from sequence number", lastExecuted);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const submittedWormholeMessage = new SubmittedWormholeMessage(
      await matchedVault.getEmitter(),
      lastExecuted + 1,
      matchedVault.cluster,
    );
    let vaa: Buffer;
    try {
      vaa = await submittedWormholeMessage.fetchVaa();
    } catch (e) {
      console.log(e);
      console.log("no vaa found for sequence", lastExecuted + 1);
      break;
    }
    const parsedVaa = parseVaa(vaa);
    const action = decodeGovernancePayload(parsedVaa.payload);
    if (!action) {
      console.log("can not decode vaa, skipping");
    } else if (
      action.targetChainId === "unset" ||
      contract.getChain().wormholeChainName === action.targetChainId
    ) {
      console.log("executing vaa", lastExecuted + 1);
      await contract.executeGovernanceInstruction(
        toPrivateKey(argv["private-key"]),
        vaa,
      );
    } else {
      console.log(
        `vaa is not for this chain (${
          contract.getChain().wormholeChainName
        } != ${action.targetChainId}, skipping`,
      );
    }
    lastExecuted++;
  }
}

main();
