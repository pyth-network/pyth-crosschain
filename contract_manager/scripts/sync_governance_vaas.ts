// biome-ignore-all lint/style/noNonNullAssertion: Legacy code uses non-null assertions
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable unicorn/no-await-expression-member */
import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import type { Vault } from "../src/node/utils/governance";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on a contract.\n" +
      "Useful for recently deployed contracts.\n" +
      "Usage: $0 --contract <contract_id> --private-key <private-key>",
  )
  .options({
    contract: {
      demandOption: true,
      desc: "Contract to execute governance vaas for",
      type: "string",
    },
    offset: {
      desc: "Starting sequence number to use, if not provided will start from contract last executed governance sequence number",
      type: "number",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to sign the transactions executing the governance VAAs. Hex format, without 0x prefix.",
      type: "string",
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
    ]!;
  const devnetVault =
    DefaultStore.vaults.devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3!;
  let matchedVault: Vault;
  if (
    (await devnetVault.getEmitter()).toBuffer().toString("hex") ===
    governanceSource.emitterAddress
  ) {
    matchedVault = devnetVault;
  } else if (
    (await mainnetVault.getEmitter()).toBuffer().toString("hex") ===
    governanceSource.emitterAddress
  ) {
    matchedVault = mainnetVault;
  } else {
    throw new Error(
      "can not find a multisig that matches the governance source of the contract",
    );
  }
  let lastExecuted = await contract.getLastExecutedGovernanceSequence();
  if (argv.offset && argv.offset > lastExecuted) {
    lastExecuted = argv.offset - 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const submittedWormholeMessage = new SubmittedWormholeMessage(
      await matchedVault.getEmitter(),
      lastExecuted + 1,
      matchedVault.cluster,
    );
    let vaa: Buffer;
    try {
      vaa = await submittedWormholeMessage.fetchVaa();
    } catch (_error) {
      break;
    }
    const parsedVaa = parseVaa(vaa);
    const action = decodeGovernancePayload(parsedVaa.payload);
    if (!action) {
    } else if (
      action.targetChainId === "unset" ||
      contract.getChain().wormholeChainName === action.targetChainId
    ) {
      await contract.executeGovernanceInstruction(
        toPrivateKey(argv["private-key"]),
        vaa,
      );
    } else {
    }
    lastExecuted++;
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
