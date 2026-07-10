import process from "node:process";
import { Connection, PublicKey } from "@solana/web3.js";
import { program } from "commander";
import { printError, printLine } from "./log.js";
import type { VoteSummary } from "./vote.js";
import { buildCastVoteTransaction } from "./vote.js";
import type { VoteSide } from "./vote-side.js";
import type { WalletOptions } from "./wallet.js";
import { loadWallet, parseWalletType } from "./wallet.js";

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

type CastVoteOptions = WalletOptions & {
  proposal: string;
  side: string;
  wallet: string;
  stakeAccount: string;
  rpcUrl: string;
  dryRun?: boolean;
};

const parseSide = (value: string): VoteSide => {
  if (value === "yes" || value === "no") {
    return value;
  }
  throw new Error(`Invalid --side "${value}"; expected "yes" or "no"`);
};

const parseDerivation = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(
      `Invalid ledger derivation value "${value}"; expected a non-negative integer`,
    );
  }
  return parsed;
};

const printSummary = (summary: VoteSummary): void => {
  printLine("Vote transaction summary:");
  printLine(`  proposal:             ${summary.proposal}`);
  printLine(`  side:                 ${summary.side}`);
  printLine(`  voter:                ${summary.voter}`);
  printLine(`  stake account:        ${summary.stakeAccount}`);
  printLine(`  realm:                ${summary.realm}`);
  printLine(`  governance:           ${summary.governance}`);
  printLine(`  governing token mint: ${summary.governingTokenMint}`);
  printLine(`  token owner record:   ${summary.tokenOwnerRecord}`);
  printLine(`  voter weight record:  ${summary.voterWeightRecord}`);
  printLine(`  max voter weight:     ${summary.maxVoterWeightRecord}`);
  printLine(`  fee payer:            ${summary.feePayer}`);
  printLine("  instructions:");
  for (const [index, instruction] of summary.instructions.entries()) {
    printLine(`    [${index}] ${instruction.name}`);
    printLine(`        program:  ${instruction.programId}`);
    printLine(`        accounts: ${instruction.accountCount}`);
    printLine(`        data len: ${instruction.dataLength} bytes`);
  }
};

const castVote = async (options: CastVoteOptions): Promise<void> => {
  const side = parseSide(options.side);
  const walletType = parseWalletType(options.wallet);
  const proposal = new PublicKey(options.proposal);
  const stakeAccount = new PublicKey(options.stakeAccount);
  const dryRun = options.dryRun ?? false;
  const connection = new Connection(options.rpcUrl, "confirmed");

  const wallet = await loadWallet(walletType, options, dryRun);
  const voter = wallet.publicKey;

  const { transaction, summary } = await buildCastVoteTransaction({
    connection,
    proposal,
    side,
    stakeAccount,
    voter,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  printSummary(summary);
  printLine(`  blockhash:            ${blockhash}`);

  if (dryRun) {
    printLine("");
    printLine("Simulating transaction (dry-run)...");
    const { value } = await connection.simulateTransaction(transaction);
    if (value.logs) {
      printLine("Simulation logs:");
      for (const logLine of value.logs) {
        printLine(`  ${logLine}`);
      }
    }
    if (value.unitsConsumed !== undefined) {
      printLine(`Compute units consumed: ${value.unitsConsumed}`);
    }
    if (value.err) {
      printError(`Simulation failed: ${JSON.stringify(value.err)}`);
      process.exitCode = 1;
      return;
    }
    printLine(
      "Simulation succeeded. Re-run without --dry-run to cast the vote.",
    );
    return;
  }

  const signed = await wallet.signTransaction(transaction);

  // A Fireblocks approval can take minutes, but the blockhash baked into the
  // signed message is only valid for ~60-90s. The signature covers that
  // blockhash, so if it lapsed while waiting for approval we cannot swap in a
  // fresh one without re-signing (another approval). Fail early with an
  // actionable message instead of an opaque sendRawTransaction rejection.
  const { value: blockhashStillValid } = await connection.isBlockhashValid(
    blockhash,
    { commitment: "confirmed" },
  );
  if (!blockhashStillValid) {
    printError(
      "Transaction blockhash expired before the signature was ready (wallet approval likely took too long). Re-run the command to try again.",
    );
    process.exitCode = 1;
    return;
  }

  const signature = await connection.sendRawTransaction(signed.serialize());
  printLine(`Vote transaction sent: ${signature}`);

  const confirmation = await connection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    "confirmed",
  );
  if (confirmation.value.err) {
    printError(
      `Transaction failed on chain: ${JSON.stringify(confirmation.value.err)}`,
    );
    process.exitCode = 1;
    return;
  }
  printLine("Vote confirmed on chain.");
};

program
  .name("pyth-governance-voter")
  .description("Cast votes on Pyth DAO governance proposals");

program
  .command("cast-vote")
  .description("Cast a vote on a Pyth DAO proposal")
  .requiredOption("--proposal <pubkey>", "proposal account address")
  .requiredOption("--side <yes|no>", "vote side")
  .requiredOption("--wallet <fireblocks|hot|ledger>", "signing wallet type")
  .requiredOption(
    "--stake-account <pubkey>",
    "stake account positions address of the voter",
  )
  .option("--rpc-url <url>", "Solana RPC url", DEFAULT_RPC_URL)
  .option("--dry-run", "build and simulate the vote without sending it")
  .option(
    "--hot-wallet-path <path>",
    "path to a keypair json file (required for --wallet hot)",
  )
  .option(
    "--ledger-derivation-account <number>",
    "ledger derivation account (for --wallet ledger)",
    parseDerivation,
  )
  .option(
    "--ledger-derivation-change <number>",
    "ledger derivation change (for --wallet ledger)",
    parseDerivation,
  )
  .action(castVote);

program.parseAsync().catch((error: unknown) => {
  printError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
