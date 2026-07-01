/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import { generateKeyPairSync } from "node:crypto";

import { ClientContext } from "@pythnetwork/pyth-lazer-cardano-cli/client";
import { applyGovernanceAction } from "@pythnetwork/pyth-lazer-cardano-cli/transactions";
import { prepareGovernanceAction } from "@pythnetwork/pyth-lazer-cardano-cli/wormhole";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { CardanoChain } from "../src/core/chains";
import { CardanoLazerContract } from "../src/core/contracts";
import { loadHotWallet, WormholeEmitter } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

// ─────────────────────────────────────────────────────────────────────────────
// Deploying the throwaway contract these tests run against
//
// The canonical mainnet deployment (policy `c935c937…e154`) is owned by the Pyth
// DAO multisig — Wormhole governance VAAs only originate after a Squads vote. To
// exercise the governance flow end-to-end without the multisig, deploy a
// throwaway instance on `preview` (or `preprod`) whose governance emitter is a
// Solana key YOU control, then sign VAAs directly with that key.
//
// Throwaway deploy (run from `pyth-crosschain/lazer/contracts/cardano/cli/js`,
// following its README):
//   1. Prepare `.env` per `.env.example` (provider key + a funded CARDANO_MNEMONIC).
//   2. pnpm cli build --env preview
//   3. pnpm cli init --network preview --emitter-chain 1 \
//        --emitter-address <hex of your Solana emitter pubkey as 32 bytes>
//      -> prints the deployed PYTH_ID (policy id). Pass it via --policy-id.
//
// The preview/preprod deployments embed the Wormhole *testnet* guardian set, so
// the VAA must be signed by those guardians: post the governance message on
// Solana `devnet` (the `--guardian-cluster` default), funding the --emitter
// wallet there (devnet SOL is free via `solana airdrop`). This mirrors
// `manage_cardano_governance.ts`, which posts on `devnet`.
//
// Faucets:
//   - Cardano `preview` ADA: https://docs.cardano.org/cardano-testnets/tools/faucet
//   - Solana devnet SOL: `solana airdrop 1 <addr> --url devnet`
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_GUARDIAN_CLUSTER = "devnet";
const DEFAULT_CHAIN = "cardano_preview";

/** Maps a store chain id to the Aiken env the dispatch helpers expect. */
const DISPATCH_ENV: Record<string, "preprod" | "preview" | undefined> = {
  cardano_preprod: "preprod",
  cardano_preview: "preview",
};

function getChain(name: string): CardanoChain {
  const chain = DefaultStore.chains[name];
  if (!(chain instanceof CardanoChain)) {
    throw new TypeError(`Not a valid Cardano chain: ${name}`);
  }
  return chain;
}

/** A fresh 32-byte Ed25519 verification key that signs nothing. */
function dummyTrustedSigner(): string {
  // Cardano stores Ed25519 trusted-signer keys (`VerificationKey` in
  // pyth_state.ak), matching Lazer's Ed25519-signed "solana" update format.
  // The test only exercises add/remove round-trips, so the key never signs.
  const { publicKey } = generateKeyPairSync("ed25519");
  const { x } = publicKey.export({ format: "jwk" });
  return Buffer.from(x as string, "base64url").toString("hex");
}

function digestToHex(digest: unknown): string {
  if (typeof digest === "string") return digest;
  if (digest instanceof Uint8Array) return Buffer.from(digest).toString("hex");
  return String(digest);
}

/**
 * Produce a guardian-signed governance VAA for `payload` by posting it directly
 * through the `--emitter` wallet on `guardianCluster`. This is the test-only
 * stand-in for the mainnet path, where the VAA only exists after the DAO Squads
 * multisig votes and executes the proposal.
 */
async function signGovernanceVaa(
  payload: Buffer,
  emitterPath: string,
  guardianCluster: string,
): Promise<Buffer> {
  const emitterWallet = await loadHotWallet(emitterPath);
  const emitter = new WormholeEmitter(guardianCluster, emitterWallet);
  console.info(
    `Governance emitter (must equal the deployment's emitter address): ${emitterWallet.publicKey.toBase58()}`,
  );
  console.info(`Posting governance message on '${guardianCluster}'...`);
  const submitted = await emitter.sendMessage(payload);
  console.info(
    `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
  );
  return submitted.fetchVaa(30);
}

/**
 * Submit a signed governance `vaa` to the Cardano deployment by building and
 * running the spend transaction that carries the VAA as redeemer data. Surfaces
 * the common misconfiguration: a VAA signed by guardians the deployment does not
 * hold, or posted from an emitter the deployment was not initialized with.
 */
async function dispatchGovernance(
  ctx: ClientContext,
  policyId: string,
  vaa: Buffer,
  env: "preprod" | "preview" | undefined,
): Promise<string> {
  try {
    const prepared = prepareGovernanceAction(vaa);
    const [digest] = await ctx.run(() =>
      applyGovernanceAction(ctx, policyId, prepared, env),
    );
    return digestToHex(digest);
  } catch (error: unknown) {
    console.error(
      "Governance dispatch failed. The two common causes are:\n" +
        "  - Invalid guardian signatures: the VAA was signed by a guardian set\n" +
        "    the deployment does not hold. Post the message on the cluster whose\n" +
        "    guardians match the deployment's guardian set (preview/preprod embed\n" +
        "    the Wormhole testnet guardians -> post on Solana `devnet`).\n" +
        "  - Invalid governance data source: the --emitter wallet is not the\n" +
        "    deployment's configured emitter. Use the key the deployment was\n" +
        "    initialized with (`--emitter-address` in `cli init`).",
    );
    throw error;
  }
}

/** Read the on-chain expiry (unix seconds) of `pubkey`, or undefined if absent. */
async function getSignerExpiry(
  lazer: CardanoLazerContract,
  pubkey: string,
): Promise<bigint | undefined> {
  const signers = await lazer.getTrustedSigners();
  return signers.find((s) => s.publicKey === pubkey)?.expiresAt;
}

const commonOptions = {
  "api-key": {
    default: "",
    description:
      "Provider (Koios) token used by the Cardano signing client. Koios works " +
      "tokenless at low rate, so this is optional.",
    type: "string",
  },
  "cardano-wallet": {
    demandOption: true,
    description:
      "Cardano wallet mnemonic (space-separated words) that pays for and signs " +
      "the dispatch transaction. Authority comes from the VAA, not this wallet.",
    type: "string",
  },
  emitter: {
    demandOption: true,
    description:
      "Path to a Solana keypair (JSON array) used as the Wormhole governance " +
      "emitter. Must be the throwaway deployment's emitter address, and must " +
      "post on `--guardian-cluster` so its guardians sign the VAA.",
    type: "string",
  },
  "guardian-cluster": {
    default: DEFAULT_GUARDIAN_CLUSTER,
    description:
      "Solana cluster to post the governance message on. Its guardians sign the " +
      "VAA, so it must match the guardian set the deployment embeds (preview/" +
      "preprod use the Wormhole testnet guardians -> `devnet`).",
    type: "string",
  },
  "policy-id": {
    demandOption: true,
    description:
      "Hex policy id of your throwaway Cardano deployment (printed by `cli init`).",
    type: "string",
  },
} as const satisfies Record<string, Options>;

const parser = yargs(hideBin(process.argv))
  .usage(
    "E2E tests for Cardano PythLazer governance via contract_manager.\n" +
      "Drives the integrated contract_manager -> Wormhole -> Cardano path against " +
      "a throwaway testnet deployment you create, signing the VAA directly with " +
      "the --emitter key (the test stand-in for the DAO multisig).",
  )
  .epilogue(
    "Deploy the throwaway instance first (the canonical deployment is DAO-owned " +
      "and rejects a self-signed VAA) — see the header comment in this file for " +
      "the `cli init` commands and faucet links.",
  )
  .options({
    chain: {
      alias: "c",
      coerce: getChain,
      default: DEFAULT_CHAIN,
      description: "chain name (from CardanoChains.json)",
      type: "string",
    },
  })
  .strict()
  .demandCommand(1);

parser.command(
  "test-update-trusted-signer",
  "E2E: add a dummy trusted signer, assert it, then remove it (cleanup)",
  (b) =>
    b.options({
      "api-key": commonOptions["api-key"],
      "cardano-wallet": commonOptions["cardano-wallet"],
      emitter: commonOptions.emitter,
      expires: {
        coerce: BigInt,
        // Far-future default so the assertion is stable; the signer is removed
        // again in teardown regardless.
        default: "4102444800", // 2100-01-01
        description: "expiry timestamp (unix seconds) for the dummy signer",
        type: "string",
      },
      "guardian-cluster": commonOptions["guardian-cluster"],
      "policy-id": commonOptions["policy-id"],
      signer: {
        description:
          "32-byte Ed25519 key (hex, no 0x) to add/remove. Defaults to a fresh " +
          "dummy key generated in-script.",
        type: "string",
      },
    }),
  async ({
    chain,
    "api-key": apiKey,
    "cardano-wallet": cardanoWallet,
    emitter: emitterPath,
    expires,
    "guardian-cluster": guardianCluster,
    "policy-id": policyId,
    signer,
  }) => {
    const lazer = new CardanoLazerContract(chain, policyId);
    const env = DISPATCH_ENV[chain.getId()];
    const ctx = await ClientContext.create(
      chain.network,
      { token: apiKey, type: "koios" },
      cardanoWallet,
    );

    const pubkey = signer ?? dummyTrustedSigner();
    console.info(`Dummy trusted signer: ${pubkey}`);

    const existing = await getSignerExpiry(lazer, pubkey);
    if (existing !== undefined) {
      throw new Error(
        `Signer already trusted (expiry ${existing.toString()}); refusing to ` +
          "clobber it. Pick a different --signer.",
      );
    }

    // 1. Add the signer.
    console.info(`\n[1/2] Adding signer with expiry ${expires.toString()}...`);
    const addPayload = lazer.generateUpdateTrustedSignerPayload(
      pubkey,
      expires,
    );
    const addVaa = await signGovernanceVaa(
      addPayload,
      emitterPath,
      guardianCluster,
    );
    const addTx = await dispatchGovernance(ctx, policyId, addVaa, env);
    console.info(`Dispatched: ${addTx}`);

    const afterAdd = await getSignerExpiry(lazer, pubkey);
    if (afterAdd !== expires) {
      throw new Error(
        `Assertion failed: expected expiry ${expires.toString()}, read ` +
          `${afterAdd === undefined ? "<absent>" : afterAdd.toString()}.`,
      );
    }
    console.info("Asserted: signer present with expected expiry.");

    // 2. Teardown — remove the signer (expiry 0) and assert it is gone.
    console.info("\n[2/2] Removing signer (teardown)...");
    const removePayload = lazer.generateUpdateTrustedSignerPayload(pubkey, 0n);
    const removeVaa = await signGovernanceVaa(
      removePayload,
      emitterPath,
      guardianCluster,
    );
    const removeTx = await dispatchGovernance(ctx, policyId, removeVaa, env);
    console.info(`Dispatched: ${removeTx}`);

    const afterRemove = await getSignerExpiry(lazer, pubkey);
    if (afterRemove !== undefined) {
      throw new Error(
        `Teardown failed: signer still present (expiry ${afterRemove.toString()}).`,
      );
    }
    console.info("Asserted: signer removed. Contract restored to start state.");
    console.info("\ntest-update-trusted-signer: PASS");
  },
);

await parser.parseAsync();
