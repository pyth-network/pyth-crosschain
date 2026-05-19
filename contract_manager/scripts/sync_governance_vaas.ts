/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
/** biome-ignore-all lint/style/noNonNullAssertion: store lookups are always present */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable unicorn/no-await-expression-member */
import fs from "node:fs";

import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import {
  EvmExecutorContract,
  EvmPriceFeedContract,
} from "../src/core/contracts/evm";
import type { Vault } from "../src/node/utils/governance";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Tries to execute all vaas on one or more contracts.\n" +
      "Useful for recently deployed contracts.\n" +
      "Usage: $0 (--contract <id> | --contracts-file <path> | --all) --private-key <hex>",
  )
  .options({
    all: {
      default: false,
      desc: "Sync all mainnet pricefeed/executor contracts in the store.",
      type: "boolean",
    },
    contract: {
      array: true,
      desc: "Contract id(s) to execute governance vaas for. Can be passed multiple times.",
      type: "string",
    },
    "contracts-file": {
      desc: "Path to a newline-separated file of contract ids.",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Decode and print what would be executed; do not submit transactions.",
      type: "boolean",
    },
    "gas-price-gwei": {
      desc: "Override gasPrice (gwei). Useful on chains with fast-moving base fees.",
      type: "number",
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

  const contracts: (EvmPriceFeedContract | EvmExecutorContract)[] = [];
  if (argv.all) {
    for (const c of Object.values(DefaultStore.contracts)) {
      if (c instanceof EvmPriceFeedContract && c.chain.isMainnet())
        contracts.push(c);
    }
    for (const c of Object.values(DefaultStore.executor_contracts)) {
      if (c.chain.isMainnet()) contracts.push(c);
    }
  }
  const ids = [...(argv.contract ?? [])];
  if (argv["contracts-file"]) {
    ids.push(
      ...fs
        .readFileSync(argv["contracts-file"], "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#")),
    );
  }
  for (const id of ids) {
    const c = DefaultStore.contracts[id] || DefaultStore.executor_contracts[id];
    if (!c) {
      console.warn(`[WARN] contract ${id} not found, skipping`);
      continue;
    }
    if (
      !(c instanceof EvmPriceFeedContract || c instanceof EvmExecutorContract)
    ) {
      console.warn(`[WARN] contract ${id} is not an EVM contract, skipping`);
      continue;
    }
    contracts.push(c);
  }
  if (contracts.length === 0) {
    throw new Error("Must provide --contract, --contracts-file, or --all");
  }

  for (const contract of contracts) {
    if (contracts.length > 1) console.log(`=== ${contract.getId()} ===`);

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
      console.log("devnet multisig matches governance source");
      matchedVault = devnetVault;
    } else if (
      (await mainnetVault.getEmitter()).toBuffer().toString("hex") ===
      governanceSource.emitterAddress
    ) {
      console.log("mainnet multisig matches governance source");
      matchedVault = mainnetVault;
    } else {
      console.log("no multisig matches governance source, skipping");
      continue;
    }
    // EvmExecutorContract returns a string, EvmPriceFeedContract returns a number; coerce to be safe.
    let lastExecuted = Number(
      await contract.getLastExecutedGovernanceSequence(),
    );
    console.log("last executed governance sequence", lastExecuted);
    if (argv.offset && argv.offset > lastExecuted) {
      console.log("skipping to offset", argv.offset);
      lastExecuted = argv.offset - 1;
    }
    console.log("Starting from sequence number", lastExecuted);

    // Optional gas-price override (e.g. for Arbitrum's fast-moving base fee).
    const originalGetGasPrice = contract.chain.getGasPrice.bind(contract.chain);
    if (argv["gas-price-gwei"] !== undefined) {
      const gasPriceWei = Math.trunc(argv["gas-price-gwei"] * 1e9).toString();
      contract.chain.getGasPrice = async () => gasPriceWei;
    }

    try {
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
        } catch {
          console.log(
            `reached end of VAA queue at sequence ${lastExecuted + 1}`,
          );
          break;
        }
        const parsedVaa = parseVaa(vaa);
        const action = decodeGovernancePayload(parsedVaa.payload);
        if (!action) {
          console.log("can not decode vaa, skipping");
        } else if (
          action.targetChainId === "unset" ||
          contract.chain.wormholeChainName === action.targetChainId
        ) {
          if (argv["dry-run"]) {
            console.log(`[dry-run] would execute vaa ${lastExecuted + 1}`);
          } else {
            console.log("executing vaa", lastExecuted + 1);
            try {
              await contract.executeGovernanceInstruction(
                toPrivateKey(argv["private-key"]),
                vaa,
              );
            } catch (error) {
              console.log(
                `failed to execute vaa ${lastExecuted + 1}, continuing:`,
                (error as Error).message,
              );
            }
          }
        } else {
          console.log(
            `vaa is not for this chain (${
              contract.chain.wormholeChainName
            } != ${action.targetChainId}, skipping`,
          );
        }
        lastExecuted++;
      }
    } finally {
      contract.chain.getGasPrice = originalGetGasPrice;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
