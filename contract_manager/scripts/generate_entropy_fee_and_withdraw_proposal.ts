/* eslint-disable no-console */
/**
 * Entropy fee recalibration + DAO fee collection proposal generator (Q3 2026).
 *
 * Builds ONE Squads proposal containing, in this order:
 *   1. setPythFee(newFee) for every chain in the config's "setFee" section
 *   2. withdrawFee(accrued -> PC multisig) for every chain in "withdraw"
 *
 * Both are EvmExecute governance instructions: the per-chain executor contract
 * (admin/owner of the Entropy proxy) performs the call, matching the Q2 fee
 * proposal (43L1ZBTFvSnWexjPKMZ5foNwy57Hh2p42jfrVyKvhrKR).
 *
 * Withdrawal amounts are queried live (getAccruedPythFees) at generation time.
 * Accrued fees decrease only when a governance withdrawFee executes, so
 * barring a competing withdrawal proposal the queried amount remains a lower
 * bound at execution time and the withdrawal will not revert. Ordering within
 * the proposal is not safety-critical; fees-first is kept for readability.
 * Withdraw targets must be deployed contracts (PC Safes); the script refuses
 * entries whose target has no code on that chain.
 *
 * Default is a dry run that prints all payloads. Pass --submit together with
 * --ops-key-path to create the proposal on the mainnet-beta vault.
 *
 * Usage:
 *   pnpm tsx scripts/generate_entropy_fee_and_withdraw_proposal.ts \
 *     --config-path <config.json> [--submit --ops-key-path <path>]
 *
 * Config shape (SetFeeEntry / WithdrawEntry below):
 *   { "setFee":   [{ "chainName": "blast", "newFeeInWei": "10000000000000" }],
 *     "withdraw": [{ "chainName": "blast", "targetAddress": "0x..." }] }
 */
import fs from "node:fs";
import path from "node:path";

import { PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmChain } from "../src/core/chains";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { findEntropyContract } from "./common";

const GET_PYTH_FEE_SELECTOR = "0x7e0020af"; // getPythFee()

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --config-path <path> [--submit --ops-key-path <path>] [--rpc-url <solana_rpc>]",
  )
  .options({
    "config-path": {
      demandOption: true,
      desc: "Path to the config JSON (setFee + withdraw sections)",
      type: "string",
    },
    "ops-key-path": {
      desc: "Path to the ops key file (required with --submit)",
      type: "string",
    },
    "priority-fee-microlamports": {
      default: 50_000,
      desc: "Compute unit price for the Solana transactions",
      type: "number",
    },
    proposal: {
      desc: "Resume an existing draft proposal from an earlier partial run with the same config (appends missing instructions, then activates)",
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

interface SetFeeEntry {
  chainName: string;
  newFeeInWei: string;
}
interface WithdrawEntry {
  chainName: string;
  targetAddress: string | null;
}

async function main() {
  const argv = await parser.argv;
  const config = JSON.parse(
    fs.readFileSync(path.resolve(argv["config-path"]), "utf8"),
  ) as { setFee: SetFeeEntry[]; withdraw: WithdrawEntry[] };

  const payloads: Buffer[] = [];
  const summary: string[] = [];

  // Part 1: setPythFee.
  for (const entry of config.setFee) {
    const chain = DefaultStore.getChainOrThrow(entry.chainName, EvmChain);
    const contract = findEntropyContract(chain);
    const currentFeeHex = await chain.getWeb3().eth.call({
      data: GET_PYTH_FEE_SELECTOR,
      to: contract.address,
    });
    const currentFee = BigInt(currentFeeHex);
    payloads.push(await contract.generateSetPythFeePayload(entry.newFeeInWei));
    summary.push(
      `${payloads.length}. setPythFee   ${entry.chainName}: ${currentFee} -> ${entry.newFeeInWei} wei` +
        (currentFee === BigInt(entry.newFeeInWei) ? " (UNCHANGED?)" : ""),
    );
  }

  // Part 2: withdrawFee, amounts queried live.
  const missing = config.withdraw.filter((w) => !w.targetAddress);
  if (missing.length > 0) {
    console.warn(
      `WARNING: ${missing.length}/${config.withdraw.length} withdraw entries have no target address yet ` +
        `(skipped): ${missing.map((w) => w.chainName).join(", ")}`,
    );
    if (argv.submit)
      throw new Error(
        "Cannot submit with withdraw entries missing target addresses. Fill or remove them first.",
      );
  }
  for (const entry of config.withdraw) {
    if (!entry.targetAddress) continue;
    const chain = DefaultStore.getChainOrThrow(entry.chainName, EvmChain);
    const contract = findEntropyContract(chain);
    const targetCode = await chain
      .getWeb3()
      .eth.getCode(entry.targetAddress);
    if (targetCode === "0x" || targetCode === "")
      throw new Error(
        `Withdraw target ${entry.targetAddress} has no code on ${entry.chainName} — not a deployed Safe`,
      );
    const accrued = BigInt(await contract.getAccruedPythFees());
    if (accrued === 0n) {
      summary.push(`--  withdrawFee  ${entry.chainName} SKIPPED (accrued 0)`);
      continue;
    }
    payloads.push(
      await contract.generateWithdrawFeePayload(
        entry.targetAddress,
        accrued.toString(),
      ),
    );
    summary.push(
      `${payloads.length}. withdrawFee  ${entry.chainName} ${accrued} wei -> ${entry.targetAddress}`,
    );
  }

  // Summary lines are numbered by payload index at push time so the numbers
  // always match the instruction positions in the proposal (skipped entries
  // get no number).
  console.log(`\n=== ${payloads.length} payloads ===`);
  for (const line of summary) console.log(line);
  console.log("\n=== payload hex ===");
  for (const p of payloads) console.log(p.toString("hex"));

  if (!argv.submit) {
    console.log(
      "\nDry run complete. Re-run with --submit --ops-key-path to propose.",
    );
    return;
  }
  if (!argv["ops-key-path"])
    throw new Error("--submit requires --ops-key-path");
  const vault = DefaultStore.vaults[argv.vault];
  if (!vault) throw new Error(`Vault '${argv.vault}' does not exist.`);
  const keypair = await loadHotWallet(argv["ops-key-path"]);
  vault.connect(
    keypair,
    argv["rpc-url"] ? () => argv["rpc-url"] as string : undefined,
  );
  const proposal = await vault.proposeWormholeMessage(
    payloads,
    argv.proposal ? new PublicKey(argv.proposal) : undefined,
    { computeUnitPriceMicroLamports: argv["priority-fee-microlamports"] },
  );
  console.log("Proposal address:", proposal.address.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
