/* eslint-disable no-console */
/**
 * OP-PIP-128: Core sunset proposal generator.
 *
 * Builds ONE Squads proposal containing, in this order:
 *   1. SetFee(0) for every mainnet EVM chain with a Pyth price feed contract
 *   2. UpgradeContract for chains running pre-WithdrawFee implementations
 *   3. WithdrawFee(full balance -> PC multisig) for chains with PC Safe coverage
 *
 * Ordering matters: the Pyth contract enforces strictly increasing wormhole
 * sequence numbers per contract, so placing upgrades before withdrawals
 * guarantees each chain is upgrade-capable before its withdrawal executes.
 *
 * Withdrawal amounts are queried live at generation time. Balances can only
 * grow until SetFee(0) executes, so the queried amount is a guaranteed lower
 * bound at execution time and the withdrawal can never revert.
 *
 * Default is a dry run that prints all payloads. Pass --submit together with
 * --ops-key-path to create the proposal on the mainnet-beta vault.
 *
 * Usage:
 *   pnpm tsx scripts/generate_core_sunset_proposal.ts \
 *     --config-path scripts/generate_core_sunset_config.json [--submit --ops-key-path <path>]
 */
import fs from "node:fs";
import path from "node:path";

import { WithdrawFee } from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const U64_MAX = 2n ** 64n;

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --config-path <path> [--submit --ops-key-path <path>] [--rpc-url <solana_rpc>]",
  )
  .options({
    "config-path": {
      demandOption: true,
      desc: "Path to the sunset config JSON (upgrade + withdraw sections)",
      type: "string",
    },
    "ops-key-path": {
      desc: "Path to the ops key file (required with --submit)",
      type: "string",
    },
    "rpc-url": {
      // eslint-disable-next-line n/no-process-env, turbo/no-undeclared-env-vars
      default: process.env.SOLANA_RPC_URL,
      desc: "Solana RPC URL",
      type: "string",
    },
    submit: {
      default: false,
      desc: "Actually create the Squads proposal (otherwise dry run)",
      type: "boolean",
    },
    vault: {
      default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
      desc: "Vault ID",
      type: "string",
    },
  });

interface UpgradeEntry {
  chainName: string;
  newImplementation: string | null;
}
interface WithdrawEntry {
  chainName: string;
  pythContract: string;
  targetAddress: string;
}

/** Encode a wei amount as (value, expo) with value < 2^64 and value*10^expo <= wei. */
function toValueExpo(wei: bigint): { value: bigint; expo: bigint } {
  let expo = 0n;
  let value = wei;
  while (value >= U64_MAX) {
    expo += 1n;
    value = wei / 10n ** expo;
  }
  return { value, expo };
}

async function main() {
  const argv = await parser.argv;
  const config = JSON.parse(
    fs.readFileSync(path.resolve(argv["config-path"]), "utf8"),
  ) as { upgrade: UpgradeEntry[]; withdraw: WithdrawEntry[] };

  const payloads: Buffer[] = [];
  const summary: string[] = [];

  // Part 2 payloads (SetFee) come first in the array so every chain's fee is
  // frozen before (or at worst alongside) its upgrade and withdrawal.
  const feeChains = [
    ...new Set(
      Object.values(DefaultStore.contracts)
        .filter(
          (c): c is EvmPriceFeedContract =>
            c instanceof EvmPriceFeedContract && c.getChain().isMainnet(),
        )
        .map((c) => c.getChain().getId()),
    ),
  ].sort();
  for (const chainName of feeChains) {
    const chain = DefaultStore.getChainOrThrow(chainName);
    payloads.push(chain.generateGovernanceSetFeePayload(0, 0));
    summary.push(`SetFee(0)   ${chainName}`);
  }

  // Part 1 payloads (UpgradeContract).
  const missing = config.upgrade.filter((u) => !u.newImplementation);
  if (missing.length > 0) {
    console.warn(
      `WARNING: ${missing.length}/${config.upgrade.length} upgrade entries have no implementation address yet: ` +
        missing.map((u) => u.chainName).join(", "),
    );
    if (argv.submit)
      throw new Error(
        "Cannot submit with missing implementation addresses. Deploy implementations first.",
      );
  }
  for (const entry of config.upgrade) {
    if (!entry.newImplementation) continue;
    const chain = DefaultStore.getChainOrThrow(entry.chainName);
    if (!(chain instanceof EvmChain))
      throw new Error(`${entry.chainName} is not an EVM chain`);
    payloads.push(
      chain.generateGovernanceUpgradePayload(
        entry.newImplementation.replace("0x", ""),
      ),
    );
    summary.push(`Upgrade     ${entry.chainName} -> ${entry.newImplementation}`);
  }

  // Part 3 payloads (WithdrawFee), amounts queried live.
  for (const entry of config.withdraw) {
    const contract = Object.values(DefaultStore.contracts).find(
      (c): c is EvmPriceFeedContract =>
        c instanceof EvmPriceFeedContract &&
        c.getChain().getId() === entry.chainName &&
        c.address.toLowerCase() === entry.pythContract.toLowerCase(),
    );
    if (!contract)
      throw new Error(
        `No price feed contract ${entry.pythContract} on ${entry.chainName} in the store`,
      );
    const chain = contract.getChain() as EvmChain;
    const fee = await contract.getTotalFee();
    const { value, expo } = toValueExpo(fee.amount);
    if (value === 0n) {
      summary.push(`Withdraw    ${entry.chainName} SKIPPED (balance 0)`);
      continue;
    }
    payloads.push(
      new WithdrawFee(
        chain.wormholeChainName,
        Buffer.from(entry.targetAddress.replace("0x", ""), "hex"),
        value,
        expo,
      ).encode(),
    );
    summary.push(
      `Withdraw    ${entry.chainName} ${fee.amount} wei -> ${entry.targetAddress} (value=${value}, expo=${expo})`,
    );
  }

  console.log(`\n=== ${payloads.length} payloads ===`);
  for (const [i, line] of summary.entries()) console.log(`${i + 1}. ${line}`);
  console.log("\n=== payload hex ===");
  for (const p of payloads) console.log(p.toString("hex"));

  if (!argv.submit) {
    console.log("\nDry run complete. Re-run with --submit --ops-key-path to propose.");
    return;
  }
  if (!argv["ops-key-path"]) throw new Error("--submit requires --ops-key-path");
  const vault = DefaultStore.vaults[argv.vault];
  if (!vault) throw new Error(`Vault '${argv.vault}' does not exist.`);
  const keypair = await loadHotWallet(argv["ops-key-path"]);
  vault.connect(keypair, argv["rpc-url"] ? () => argv["rpc-url"] as string : undefined);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address:", proposal.address.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
