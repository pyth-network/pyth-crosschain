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
import type { PythCluster } from "@pythnetwork/client";
import { getPythClusterApiUrl } from "@pythnetwork/client";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toDeploymentType } from "../src/core/base";
import {
  loadHotWallet,
  SubmittedWormholeMessage,
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
 * Recovers the sequence numbers a proposal emitted, from the transactions that executed it.
 *
 * The sequence number is assigned by the wormhole program at execution time and is not derivable
 * from the proposal, so a proposal executed elsewhere — the multisig UI, an earlier run — leaves no
 * record of it anywhere this tool can compute. What it does leave is transactions against the
 * proposal account, and each one logs the sequence of the message it posted.
 * @param {PublicKey} proposalAddress The proposal to look up.
 * @param {PublicKey} emitter The vault's emitter, so messages from anything else are ignored.
 * @param {PythCluster} cluster The cluster the proposal lives on.
 * @returns The sequence numbers it emitted, ascending.
 */
async function recoverSequences(
  proposalAddress: PublicKey,
  emitter: PublicKey,
  cluster: PythCluster,
): Promise<number[]> {
  const connection = new Connection(getPythClusterApiUrl(cluster), "confirmed");
  const history = await connection.getSignaturesForAddress(proposalAddress, {
    limit: 100,
  });
  const sequences = new Set<number>();
  // Oldest first, so the sequences come out in the order they were emitted.
  for (const entry of [...history].reverse()) {
    if (entry.err !== null) continue;
    let message: SubmittedWormholeMessage;
    try {
      message = await SubmittedWormholeMessage.fromTransactionSignature(
        entry.signature,
        cluster,
      );
    } catch {
      // Approvals, the proposal's own creation, anything that posted no wormhole message.
      continue;
    }
    if (!message.emitter.equals(emitter)) continue;
    if (Number.isNaN(message.sequenceNumber)) continue;
    sequences.add(message.sequenceNumber);
  }
  return [...sequences].sort((a, b) => a - b);
}

/**
 * Prints the emitted sequences and the flags the execute phase takes.
 * @param {number[]} sequences The sequence numbers, ascending.
 */
function printSequences(sequences: number[]): void {
  console.log(`\nEmitted ${sequences.length} wormhole message(s):`);
  for (const sequence of sequences) console.log(`  sequence ${sequence}`);
  console.log(
    `\n--from-sequence ${sequences[0]} --to-sequence ${sequences.at(-1)}`,
  );
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

  // Already executed, here or elsewhere: recover what it emitted rather than making the sequence
  // range something to hunt for by hand. Read-only, so a dry run takes this path too.
  if (state === "executed") {
    console.log("\nAlready executed. Recovering the sequences it emitted...");
    const sequences = await recoverSequences(
      proposalAddress,
      await vault.getEmitter(),
      vault.cluster,
    );
    if (sequences.length === 0) {
      throw new Error(
        "This proposal has executed but posted no wormhole message from this vault's emitter, " +
          "or its transactions have fallen out of the RPC's history.",
      );
    }
    printSequences(sequences);
    return;
  }

  if (argv.dryRun) {
    console.log(
      `\n--dry-run set, nothing approved or executed. State ${state}.`,
    );
    return;
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
  if (argv.waitSeconds > 0) await waitForVaas(messages, argv.waitSeconds);
  printSequences(
    messages.map((message) => message.sequenceNumber).sort((a, b) => a - b),
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
