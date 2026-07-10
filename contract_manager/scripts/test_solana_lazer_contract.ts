/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { Keypair, PublicKey } from "@solana/web3.js";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { SvmChain } from "../src/core/chains";
import { SolanaLazerContract } from "../src/core/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Deploying the throwaway contract these tests run against
//
// The Solana Lazer program is a single Anchor program gated by a direct on-chain
// `top_authority: Signer` constraint — there is NO Wormhole executor / VAA. The
// canonical mainnet program is owned by the Pyth DAO Squads multisig signer
// `6oXTdojyfDS8m5VtTaYB9xRCxpKGSvKJFndLUPV3V3wT`. To exercise the governance flow
// end-to-end without going through the multisig, deploy a throwaway instance of
// `pyth-lazer-solana-contract` to devnet whose `top_authority` is a keypair you
// control. The test stand-in for "the DAO multisig" is "you, holding that key".
//
// All `test-*` commands then take the deployed program id via `--program-id` and
// the `top_authority` key via `--top-authority-key`.
//
// Throwaway deploy (run from `pyth-lazer/contracts/solana/`):
//   1. solana-keygen new -o /tmp/lazer-test-program.json   # fresh program keypair
//   2. anchor build && solana program deploy \
//        --program-id /tmp/lazer-test-program.json \
//        target/deploy/pyth_lazer_solana_contract.so --url devnet
//   3. bun run setup --url https://api.devnet.solana.com \
//        --keypair-path <your-top-authority>.json \
//        --trusted-signer <any-pubkey> --expiry-time-seconds <future>
//      # initializes the Storage PDA with your keypair as `top_authority`
//   4. Pass the deployed program id and your `top_authority` key to the `test-*`
//      commands below.
//
// Faucet: airdrop devnet SOL to your wallet via `solana airdrop 2 <addr> --url
// devnet`. Funds are non-skippable — every `update` instruction costs lamports.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
// Far-future default so the assertion is stable; the signer is removed again in
// teardown regardless.
const DEFAULT_EXPIRY = "4102444800"; // 2100-01-01

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

/** A devnet SvmChain pointed at the supplied RPC URL. */
function devnetChain(rpcUrl: string): SvmChain {
  return new SvmChain("solana_devnet", false, "solana", "SOL", rpcUrl);
}

function txUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

/** A random 20-byte EVM address as `0x`-prefixed hex. */
function dummyEvmAddress(): string {
  return "0x" + randomBytes(20).toString("hex");
}

/**
 * Assert the `top_authority` keypair we hold actually controls this program's
 * storage, surfacing the two misconfiguration traps that otherwise produce an
 * opaque on-chain failure: a wrong `--program-id` (the Storage PDA is uninitialized
 * / belongs to a different program) or a `top_authority` mismatch (the `update`
 * is rejected by the `has_one = top_authority` constraint).
 */
async function assertTopAuthority(
  contract: SolanaLazerContract,
  topAuthority: Keypair,
): Promise<void> {
  let onChain: string;
  try {
    onChain = await contract.getTopAuthority();
  } catch (error: unknown) {
    console.error(
      "Could not read the Storage account. Common cause:\n" +
        "  - Wrong --program-id: the Storage PDA does not exist for this program\n" +
        "    (deploy + run `setup` first, see the header comment).",
    );
    throw error;
  }
  if (onChain !== topAuthority.publicKey.toBase58()) {
    throw new Error(
      `top_authority mismatch: program's top_authority is ${onChain}, but ` +
        `--top-authority-key is ${topAuthority.publicKey.toBase58()}. The ` +
        "update would be rejected by `has_one = top_authority`. Pass the key the " +
        "throwaway program was initialized with.",
    );
  }
}

const commonOptions = {
  "program-id": {
    demandOption: true,
    description:
      "Base58 program id of your throwaway devnet pyth-lazer-solana-contract.",
    type: "string",
  },
  "rpc-url": {
    default: DEFAULT_RPC_URL,
    description:
      "Solana RPC URL (must be a live devnet, not a local validator).",
    type: "string",
  },
  "top-authority-key": {
    demandOption: true,
    description:
      "Path to the Solana keypair (JSON array) that is the program's " +
      "top_authority — the test stand-in for the DAO multisig. Pays for and " +
      "signs the update instruction.",
    type: "string",
  },
} as const satisfies Record<string, Options>;

const parser = yargs(hideBin(process.argv))
  .usage(
    "E2E tests for Solana PythLazer governance via contract_manager.\n" +
      "Each command drives the contract_manager -> program `update*` path against " +
      "a throwaway devnet program you deploy, signing directly with the " +
      "--top-authority-key (the test stand-in for the DAO multisig).",
  )
  .epilogue(
    "Deploy the throwaway program first (the canonical mainnet program is " +
      "DAO-owned and rejects a self-signed update). See the header comment in " +
      "this file for the exact deploy + setup commands.",
  )
  .strict()
  .demandCommand(1);

parser.command(
  "test-update-trusted-signer",
  "E2E: add a dummy ed25519 trusted signer, assert it, then remove it (cleanup)",
  (b) =>
    b.options({
      expires: {
        coerce: BigInt,
        default: DEFAULT_EXPIRY,
        description: "expiry timestamp (unix seconds) for the dummy signer",
        type: "string",
      },
      "program-id": commonOptions["program-id"],
      "rpc-url": commonOptions["rpc-url"],
      signer: {
        description:
          "base58 ed25519 public key to add/remove. Defaults to a fresh key " +
          "generated in-script.",
        type: "string",
      },
      "top-authority-key": commonOptions["top-authority-key"],
    }),
  async ({
    expires,
    "program-id": programId,
    "rpc-url": rpcUrl,
    signer,
    "top-authority-key": topAuthorityKeyPath,
  }) => {
    const chain = devnetChain(rpcUrl);
    const contract = new SolanaLazerContract(chain, programId);
    const topAuthority = loadKeypair(topAuthorityKeyPath);
    await assertTopAuthority(contract, topAuthority);

    const pubkey = signer ?? Keypair.generate().publicKey.toBase58();
    console.info(`Dummy trusted signer: ${pubkey}`);

    const existing = (await contract.getTrustedSigners()).find(
      (s) => s.publicKey === pubkey,
    );
    if (existing !== undefined) {
      throw new Error(
        `Signer already trusted (expiry ${existing.expiresAt.toString()}); ` +
          "refusing to clobber it. Pick a different --signer.",
      );
    }

    // 1. Add the signer.
    console.info(`\n[1/2] Adding signer with expiry ${expires.toString()}...`);
    const addTx = await contract.updateTrustedSigner(
      topAuthority,
      new PublicKey(pubkey),
      expires,
    );
    console.info(`Dispatched: ${txUrl(addTx)}`);

    const afterAdd = (await contract.getTrustedSigners()).find(
      (s) => s.publicKey === pubkey,
    );
    if (afterAdd?.expiresAt !== expires) {
      throw new Error(
        `Assertion failed: expected expiry ${expires.toString()}, read ` +
          `${afterAdd === undefined ? "<absent>" : afterAdd.expiresAt.toString()}.`,
      );
    }
    console.info("Asserted: signer present with expected expiry.");

    // 2. Teardown — remove the signer (expiry 0) and assert it is gone.
    console.info("\n[2/2] Removing signer (teardown)...");
    const removeTx = await contract.updateTrustedSigner(
      topAuthority,
      new PublicKey(pubkey),
      0n,
    );
    console.info(`Dispatched: ${txUrl(removeTx)}`);

    const afterRemove = (await contract.getTrustedSigners()).find(
      (s) => s.publicKey === pubkey,
    );
    if (afterRemove !== undefined) {
      throw new Error(
        `Teardown failed: signer still present (expiry ${afterRemove.expiresAt.toString()}).`,
      );
    }
    console.info("Asserted: signer removed. Contract restored to start state.");
    console.info("\ntest-update-trusted-signer: PASS");
  },
);

parser.command(
  "test-update-trusted-ecdsa-signer",
  "E2E: add a dummy ECDSA (EVM-address) trusted signer, assert it, then remove it",
  (b) =>
    b.options({
      expires: {
        coerce: BigInt,
        default: DEFAULT_EXPIRY,
        description: "expiry timestamp (unix seconds) for the dummy signer",
        type: "string",
      },
      "program-id": commonOptions["program-id"],
      "rpc-url": commonOptions["rpc-url"],
      signer: {
        description:
          "0x-prefixed 20-byte EVM address to add/remove. Defaults to a fresh " +
          "random address generated in-script.",
        type: "string",
      },
      "top-authority-key": commonOptions["top-authority-key"],
    }),
  async ({
    expires,
    "program-id": programId,
    "rpc-url": rpcUrl,
    signer,
    "top-authority-key": topAuthorityKeyPath,
  }) => {
    const chain = devnetChain(rpcUrl);
    const contract = new SolanaLazerContract(chain, programId);
    const topAuthority = loadKeypair(topAuthorityKeyPath);
    await assertTopAuthority(contract, topAuthority);

    const address = (signer ?? dummyEvmAddress()).toLowerCase();
    console.info(`Dummy trusted ECDSA signer: ${address}`);

    const existing = (await contract.getTrustedEcdsaSigners()).find(
      (s) => s.address === address,
    );
    if (existing !== undefined) {
      throw new Error(
        `Signer already trusted (expiry ${existing.expiresAt.toString()}); ` +
          "refusing to clobber it. Pick a different --signer.",
      );
    }

    // 1. Add the signer.
    console.info(`\n[1/2] Adding signer with expiry ${expires.toString()}...`);
    const addTx = await contract.updateTrustedEcdsaSigner(
      topAuthority,
      address,
      expires,
    );
    console.info(`Dispatched: ${txUrl(addTx)}`);

    const afterAdd = (await contract.getTrustedEcdsaSigners()).find(
      (s) => s.address === address,
    );
    if (afterAdd?.expiresAt !== expires) {
      throw new Error(
        `Assertion failed: expected expiry ${expires.toString()}, read ` +
          `${afterAdd === undefined ? "<absent>" : afterAdd.expiresAt.toString()}.`,
      );
    }
    console.info("Asserted: signer present with expected expiry.");

    // 2. Teardown — remove the signer (expiry 0) and assert it is gone.
    console.info("\n[2/2] Removing signer (teardown)...");
    const removeTx = await contract.updateTrustedEcdsaSigner(
      topAuthority,
      address,
      0n,
    );
    console.info(`Dispatched: ${txUrl(removeTx)}`);

    const afterRemove = (await contract.getTrustedEcdsaSigners()).find(
      (s) => s.address === address,
    );
    if (afterRemove !== undefined) {
      throw new Error(
        `Teardown failed: signer still present (expiry ${afterRemove.expiresAt.toString()}).`,
      );
    }
    console.info("Asserted: signer removed. Contract restored to start state.");
    console.info("\ntest-update-trusted-ecdsa-signer: PASS");
  },
);

await parser.parseAsync();
