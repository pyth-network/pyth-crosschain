/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Approves and executes a multisig proposal, then prints the wormhole sequence numbers it emitted.
 *
 * `propose_evm_pro_cutover.ts` leaves a proposal address, and `execute_evm_pro_cutover.ts` needs the
 * sequence range of the VAAs that proposal produced. That range only exists once the proposal has
 * executed on Solana, so this script closes the gap: it executes the proposal and prints the range
 * ready to paste into the next command.
 *
 * `--approve` casts this key's approval first, which is all a single-signer test vault needs. On a
 * vault with a real threshold the other signers still approve in the multisig UI; run this without
 * `--approve` once they have.
 *
 * Nothing here is cutover-specific — it executes whatever the proposal contains.
 *
 * Usage: $0 --proposal <address> --ops-key-path <path> [--approve] [--dry-run]
 */

import { Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toDeploymentType } from "../src/core/base";
import type { SubmittedWormholeMessage } from "../src/node/utils/governance";
import {
  loadHotWallet,
  WormholeMultisigProposal,
} from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { isProDeploymentType, VAULT_BY_DEPLOYMENT_TYPE } from "./pro_cutover";

const parser = yargs(hideBin(process.argv))
  .scriptName("execute_proposal.ts")
  .usage(
    "Executes an approved multisig proposal and prints the wormhole sequence numbers it emitted.\n" +
      "Usage: $0 --proposal <address> --ops-key-path <path> [--approve] [--dry-run]",
  )
  .options({
    approve: {
      default: false,
      desc: "Approve the proposal with this key before executing. A no-op if it already approved",
      type: "boolean",
    },
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "Selects the vault that owns this deployment type's governance emitter",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Print the proposal's state and stop. Approves nothing, executes nothing, needs no key",
      type: "boolean",
    },
    "ops-key-path": {
      demandOption: false,
      desc: "Path to the signer's private key. Required unless --dry-run",
      type: "string",
    },
    proposal: {
      demandOption: true,
      desc: "Address of the proposal to execute",
      type: "string",
    },
    vault: {
      demandOption: false,
      desc: "Override the vault id. Defaults to the vault for the deployment type",
      type: "string",
    },
    "wait-seconds": {
      default: 120,
      desc: "How long to wait for the guardians to sign each emitted message. 0 skips the wait",
      type: "number",
    },
  });

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Waits for the guardians to sign each message the proposal emitted.
 *
 * The next phase fetches these VAAs by sequence number, and a run started before they are signed
 * fails with a confusing "could not fetch VAA". Reported rather than thrown: the proposal has
 * already executed by this point, so a slow guardian is not a reason to exit non-zero.
 * @param {SubmittedWormholeMessage[]} messages The messages the proposal emitted.
 * @param {number} waitSeconds How long to wait for each one.
 */
async function waitForVaas(
  messages: SubmittedWormholeMessage[],
  waitSeconds: number,
): Promise<void> {
  console.log(`\nWaiting up to ${waitSeconds}s for the guardians to sign...`);
  for (const message of messages) {
    try {
      await message.fetchVaa(waitSeconds);
      console.log(`  ✅ ${message.sequenceNumber} signed`);
    } catch (error) {
      console.log(
        `  ! ${message.sequenceNumber} not signed yet: ${describeError(error)}`,
      );
    }
  }
}

async function main() {
  const argv = await parser.argv;

  if (!argv.dryRun && argv.opsKeyPath === undefined) {
    throw new Error("--ops-key-path is required unless --dry-run is set.");
  }

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (argv.vault === undefined && !isProDeploymentType(deploymentType)) {
    throw new Error(
      `No default vault for ${deploymentType}. Pass --vault explicitly.`,
    );
  }
  const vaultId =
    argv.vault ??
    VAULT_BY_DEPLOYMENT_TYPE[
      deploymentType as keyof typeof VAULT_BY_DEPLOYMENT_TYPE
    ];
  const vault = DefaultStore.vaults[vaultId];
  if (vault === undefined) throw new Error(`Unknown vault ${vaultId}`);

  // A dry run only reads, so it connects a throwaway wallet rather than demanding a key.
  const wallet =
    argv.opsKeyPath === undefined
      ? new Wallet(Keypair.generate())
      : await loadHotWallet(argv.opsKeyPath);
  vault.connect(wallet);
  const squad = vault.getSquadOrThrow();

  const proposalAddress = new PublicKey(argv.proposal);
  const proposal = new WormholeMultisigProposal(
    proposalAddress,
    squad,
    vault.cluster,
  );

  const transaction = await squad.getTransaction(proposalAddress);
  const multisig = await squad.getMultisig(transaction.ms);
  const threshold = Number(multisig.threshold);
  const approvedBy = transaction.approved.map((key: PublicKey) =>
    key.toBase58(),
  );

  console.log(`Proposal  ${proposalAddress.toBase58()}`);
  console.log(`Vault     ${vault.getId()}`);
  console.log(`Emitter   ${(await vault.getEmitter()).toBase58()}`);
  console.log(`State     ${await proposal.getState()}`);
  console.log(`Approvals ${approvedBy.length}/${threshold}`);
  for (const key of approvedBy) console.log(`  ${key}`);
  if (argv.opsKeyPath !== undefined) {
    console.log(`Signer    ${wallet.publicKey.toBase58()}`);
  }

  if (argv.approve && !argv.dryRun) {
    if (approvedBy.includes(wallet.publicKey.toBase58())) {
      console.log("\nThis key has already approved, not approving again.");
    } else if ((await proposal.getState()) !== "active") {
      console.log(
        `\nNot approving: the proposal is ${await proposal.getState()}, not active.`,
      );
    } else {
      console.log("\nApproving...");
      await squad.approveTransaction(proposalAddress);
      const updated = await squad.getTransaction(proposalAddress);
      console.log(`Approvals now ${updated.approved.length}/${threshold}`);
    }
  }

  const state = await proposal.getState();
  if (argv.dryRun) {
    console.log(
      `\n--dry-run set, nothing approved or executed. State ${state}.`,
    );
    return;
  }

  if (state === "executed") {
    throw new Error(
      "This proposal has already executed. Its sequence numbers are on wormholescan under the " +
        "vault's emitter, newest first.",
    );
  }
  if (state !== "executeReady") {
    // Re-read rather than reusing the count printed above, which an --approve run has just changed.
    const approvals = (await squad.getTransaction(proposalAddress)).approved
      .length;
    throw new Error(
      `Proposal is ${state}, not executeReady. It needs ` +
        `${Math.max(threshold - approvals, 0)} more approval(s) before it can execute.`,
    );
  }

  console.log("\nExecuting...");
  const messages = await proposal.execute();
  const sequences = messages
    .map((message) => message.sequenceNumber)
    .sort((a, b) => a - b);

  console.log(`\nEmitted ${messages.length} wormhole message(s):`);
  for (const sequence of sequences) console.log(`  sequence ${sequence}`);

  if (argv.waitSeconds > 0) await waitForVaas(messages, argv.waitSeconds);

  console.log(
    `\n--from-sequence ${sequences[0]} --to-sequence ${sequences.at(-1)}`,
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
