/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import { createECDH } from "node:crypto";
import { readFileSync } from "node:fs";

import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import { StellarChain } from "../src/core/chains";
import {
  StellarExecutorContract,
  StellarLazerContract,
} from "../src/core/contracts";
import { loadHotWallet, WormholeEmitter } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

// ─────────────────────────────────────────────────────────────────────────────
// Deploying the throwaway contracts these tests run against
//
// These scenarios CANNOT run against the canonical testnet executor/verifier:
// those are owned by the Pyth DAO multisig, so only the DAO can produce a
// governance VAA they accept. Deploy a throwaway executor + verifier whose owner
// emitter is a key YOU control, then sign the governance VAA directly with that
// key (the test stand-in for the multisig). All `test-*` commands then take the
// deployed addresses via `--executor-contract` / `--lazer-contract`.
//
// 1. Pick the Solana keypair you will pass as `--emitter` (the Wormhole
//    governance emitter), e.g. `$HOME/.config/solana/id.json`. Its Wormhole
//    emitter address is just its public key as 32 raw bytes. `deploy.sh` wants
//    that as hex (no 0x), so derive it from the keypair's base58 pubkey (run
//    from this `contract_manager/` directory so @solana/web3.js resolves):
//
//      PUBKEY=$(solana-keygen pubkey "$EMITTER_KEY")
//      EMITTER_HEX=$(node -e "const {PublicKey}=require('@solana/web3.js'); \
//        console.log(new PublicKey(process.argv[1]).toBuffer().toString('hex'))" \
//        "$PUBKEY")
//
//    (equivalently: base58-decode the pubkey to its 32 bytes and hex-encode.)
//
// 2. Deploy the throwaway pair, overriding only the owner emitter — see deploy.sh
//    --help in `pyth-lazer/contracts/stellar/scripts/` for all flags:
//
//      ./scripts/deploy.sh --secret <stellar-secret-or-identity> \
//        --network testnet --emitter-address "$EMITTER_HEX"
//
//    deploy.sh prints the deployed executor and verifier contract addresses;
//    pass them as `--executor-contract` / `--lazer-contract`.
//
// Why mainnet-beta? deploy.sh defaults to the Wormhole *mainnet* guardian set
// (index 4) on both networks, because the canonical owner emitter lives on Solana
// mainnet. The executor checks guardian signatures against the set it holds, so
// with that default the VAA must be signed by the mainnet guardians — post the
// message on `mainnet-beta` (the `--guardian-cluster` default) with the `--emitter`
// wallet funded there to pay the Wormhole fee. (To post elsewhere, deploy with a
// matching `--guardian-set` / `--guardian-index` and set `--guardian-cluster`.)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_GUARDIAN_CLUSTER = "mainnet-beta";
const DEFAULT_CHAIN = "stellar_testnet";

function getChain(name: string): StellarChain {
  const chain = DefaultStore.chains[name];
  if (!(chain instanceof StellarChain)) {
    throw new TypeError(`Not a valid Stellar chain: ${name}`);
  }
  return chain;
}

function txUrl(chain: StellarChain, hash: string): string {
  const network = chain.isMainnet() ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/** A fresh, valid compressed secp256k1 public key that signs nothing. */
function dummyTrustedSigner(): string {
  const ecdh = createECDH("secp256k1");
  ecdh.generateKeys();
  return ecdh.getPublicKey(null, "compressed").toString("hex");
}

/**
 * Produce a guardian-signed governance VAA for `payload` by posting it directly
 * through the `--emitter` wallet on `guardianCluster`. This is the test-only stand
 * -in for the mainnet path, where the VAA only exists after the DAO Squads
 * multisig votes and executes the proposal (days later) — there, `propose` and
 * `executeGovernanceAction` are separate, manually-run steps, not one call.
 */
async function signGovernanceVaa(
  payload: Buffer,
  emitterPath: string,
  guardianCluster: string,
): Promise<Buffer> {
  const emitterWallet = await loadHotWallet(emitterPath);
  const emitter = new WormholeEmitter(guardianCluster, emitterWallet);
  console.info(
    `Governance emitter (must equal the executor's owner emitter): ${emitterWallet.publicKey.toBase58()}`,
  );
  console.info(`Posting governance message on '${guardianCluster}'...`);
  const submitted = await emitter.sendMessage(payload);
  console.info(
    `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
  );
  return submitted.fetchVaa(30);
}

/**
 * Submit a signed governance `vaa` to the executor, surfacing the two
 * misconfiguration traps that otherwise produce an opaque on-chain failure: a VAA
 * signed by a guardian set the executor does not hold (`InvalidGuardianSignature`)
 * or posted from an emitter the executor was not deployed with (invalid governance
 * data source).
 */
async function dispatchGovernance(
  executor: StellarExecutorContract,
  privateKey: string,
  vaa: Buffer,
): Promise<string> {
  try {
    const { id } = await executor.executeGovernanceAction(
      toPrivateKey(privateKey),
      vaa,
    );
    return id;
  } catch (error: unknown) {
    console.error(
      "Governance dispatch failed. The two common causes are:\n" +
        "  - InvalidGuardianSignature: the VAA was signed by a guardian set the\n" +
        "    executor does not hold. Post the message on the cluster whose\n" +
        "    guardians match the executor's deployed guardian set (`--guardian-set`\n" +
        "    / `--guardian-index` in deploy.sh).\n" +
        "  - Invalid governance data source: the emitter wallet is not the\n" +
        "    executor's configured owner emitter. Use the key the executor was\n" +
        "    deployed with (`--emitter-address` in deploy.sh).",
    );
    throw error;
  }
}

const commonOptions = {
  emitter: {
    demandOption: true,
    description:
      "Path to a Solana keypair (JSON array) used as the Wormhole governance " +
      "emitter. Must be the throwaway executor's owner emitter, and must post on " +
      "`--guardian-cluster` so its guardians sign the VAA. A mismatch is rejected " +
      "on-chain with InvalidGuardianSignature.",
    type: "string",
  },
  "executor-contract": {
    demandOption: true,
    description:
      "Soroban contract address of your throwaway wormhole-executor-stellar " +
      "(deployed with --emitter-address = your --emitter wallet's emitter).",
    type: "string",
  },
  "guardian-cluster": {
    default: DEFAULT_GUARDIAN_CLUSTER,
    description:
      "Solana cluster to post the governance message on. Its guardians sign the " +
      "VAA, so it must match the guardian set the executor was deployed with " +
      "(`--guardian-set` / `--guardian-index` in deploy.sh).",
    type: "string",
  },
  "lazer-contract": {
    demandOption: true,
    description:
      "Soroban contract address of your throwaway pyth-lazer-stellar verifier " +
      "(its executor must be the --executor-contract).",
    type: "string",
  },
  "private-key": {
    demandOption: true,
    description:
      "32-byte ed25519 seed (hex, no 0x) of the Stellar account that pays for " +
      "and signs the Soroban dispatch. Authority comes from the VAA, not this key.",
    type: "string",
  },
} as const satisfies Record<string, Options>;

const parser = yargs(hideBin(process.argv))
  .usage(
    "E2E tests for Stellar PythLazer governance via contract_manager.\n" +
      "Each command drives the integrated contract_manager -> executor -> " +
      "verifier path against a throwaway testnet contract you deploy, signing " +
      "the VAA directly with the --emitter key (the test stand-in for the DAO " +
      "multisig).",
  )
  .epilogue(
    "Deploy the throwaway executor/verifier first (the canonical testnet " +
      "contracts are DAO-owned and reject a self-signed VAA):\n" +
      "  1. Derive your --emitter wallet's Wormhole emitter (its base58 pubkey as " +
      "32-byte hex, no 0x).\n" +
      "  2. pyth-lazer/contracts/stellar/scripts/deploy.sh --secret <key> " +
      "--network testnet --emitter-address <that hex>\n" +
      "  3. Pass the printed executor/verifier addresses as --executor-contract / " +
      "--lazer-contract.\n" +
      "See the header comment in this file for the exact derivation + deploy " +
      "commands and why messages are posted on mainnet-beta.",
  )
  .options({
    chain: {
      alias: "c",
      coerce: getChain,
      default: DEFAULT_CHAIN,
      description: "chain name (from StellarChains.json)",
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
      emitter: commonOptions.emitter,
      "executor-contract": commonOptions["executor-contract"],
      expires: {
        coerce: BigInt,
        // Far-future default so the assertion is stable; the signer is removed
        // again in teardown regardless.
        default: "4102444800", // 2100-01-01
        description: "expiry timestamp (unix seconds) for the dummy signer",
        type: "string",
      },
      "guardian-cluster": commonOptions["guardian-cluster"],
      "lazer-contract": commonOptions["lazer-contract"],
      "private-key": commonOptions["private-key"],
      signer: {
        description:
          "33-byte compressed secp256k1 key (hex, no 0x) to add/remove. " +
          "Defaults to a fresh dummy key generated in-script.",
        type: "string",
      },
    }),
  async ({
    chain,
    emitter: emitterPath,
    "executor-contract": executorAddress,
    expires,
    "guardian-cluster": guardianCluster,
    "lazer-contract": lazerAddress,
    "private-key": privateKey,
    signer,
  }) => {
    const lazer = new StellarLazerContract(chain, lazerAddress);
    const executor = new StellarExecutorContract(chain, executorAddress);

    // The verifier frames the action as a Call to the executor it authorizes;
    // it must be the executor we dispatch to, or the action is unauthorized.
    const authorizedExecutor = await lazer.getExecutor();
    if (authorizedExecutor !== executor.address) {
      throw new Error(
        `Verifier authorizes executor ${authorizedExecutor}, but ` +
          `--executor-contract is ${executor.address}.`,
      );
    }

    const pubkey = signer ?? dummyTrustedSigner();
    console.info(`Dummy trusted signer: ${pubkey}`);

    const existing = await lazer.getTrustedSignerExpiry(pubkey);
    if (existing !== undefined) {
      throw new Error(
        `Signer already trusted (expiry ${existing.toString()}); refusing to ` +
          "clobber it. Pick a different --signer.",
      );
    }

    // 1. Add the signer.
    console.info(`\n[1/2] Adding signer with expiry ${expires.toString()}...`);
    const addPayload = await lazer.generateUpdateTrustedSignerPayload(
      pubkey,
      expires,
    );
    const addVaa = await signGovernanceVaa(
      addPayload,
      emitterPath,
      guardianCluster,
    );
    const addTx = await dispatchGovernance(executor, privateKey, addVaa);
    console.info(`Dispatched: ${txUrl(chain, addTx)}`);

    const afterAdd = await lazer.getTrustedSignerExpiry(pubkey);
    if (afterAdd !== expires) {
      throw new Error(
        `Assertion failed: expected expiry ${expires.toString()}, read ` +
          `${afterAdd === undefined ? "<absent>" : afterAdd.toString()}.`,
      );
    }
    console.info("Asserted: signer present with expected expiry.");

    // 2. Teardown — remove the signer (expiry 0) and assert it is gone.
    console.info("\n[2/2] Removing signer (teardown)...");
    const removePayload = await lazer.generateUpdateTrustedSignerPayload(
      pubkey,
      0n,
    );
    const removeVaa = await signGovernanceVaa(
      removePayload,
      emitterPath,
      guardianCluster,
    );
    const removeTx = await dispatchGovernance(executor, privateKey, removeVaa);
    console.info(`Dispatched: ${txUrl(chain, removeTx)}`);

    const afterRemove = await lazer.getTrustedSignerExpiry(pubkey);
    if (afterRemove !== undefined) {
      throw new Error(
        `Teardown failed: signer still present (expiry ${afterRemove.toString()}).`,
      );
    }
    console.info("Asserted: signer removed. Contract restored to start state.");
    console.info("\ntest-update-trusted-signer: PASS");
  },
);

parser.command(
  "test-upgrade",
  "E2E: upgrade the executor to a rebuilt WASM, assert it, then roll back",
  (b) =>
    b.options({
      emitter: commonOptions.emitter,
      "executor-contract": commonOptions["executor-contract"],
      "executor-wasm": {
        demandOption: true,
        description:
          "Path to a rebuilt wormhole-executor-stellar WASM with a different " +
          "hash than the deployed one (e.g. a doc-string change). Build it with " +
          "`stellar contract build`.",
        type: "string",
      },
      "guardian-cluster": commonOptions["guardian-cluster"],
      "private-key": commonOptions["private-key"],
    }),
  async ({
    chain,
    emitter: emitterPath,
    "executor-contract": executorAddress,
    "executor-wasm": wasmPath,
    "guardian-cluster": guardianCluster,
    "private-key": privateKey,
  }) => {
    const executor = new StellarExecutorContract(chain, executorAddress);
    const dispatchKey = toPrivateKey(privateKey);

    // Capture the canonical hash to roll back to.
    const originalHash = await executor.getCurrentWasmHash();
    console.info(`Current executor WASM hash: ${originalHash}`);

    // 1. Upload the rebuilt WASM and capture its hash.
    console.info(`\n[1/2] Uploading rebuilt WASM from ${wasmPath}...`);
    const wasm = readFileSync(wasmPath);
    const newHash = await chain.uploadContractWasm(wasm, dispatchKey);
    console.info(`Uploaded WASM hash: ${newHash}`);
    if (newHash === originalHash) {
      throw new Error(
        "Rebuilt WASM is identical to the deployed one; supply a WASM with a " +
          "different hash (e.g. add a doc-string) so the upgrade is observable.",
      );
    }

    // Dispatch the self-upgrade and assert the instance now runs the new hash.
    const upgradePayload = executor.generateUpgradeExecutorPayload(newHash);
    const upgradeVaa = await signGovernanceVaa(
      upgradePayload,
      emitterPath,
      guardianCluster,
    );
    const upgradeTx = await dispatchGovernance(
      executor,
      privateKey,
      upgradeVaa,
    );
    console.info(`Dispatched: ${txUrl(chain, upgradeTx)}`);

    const afterUpgrade = await executor.getCurrentWasmHash();
    if (afterUpgrade !== newHash) {
      throw new Error(
        `Assertion failed: expected WASM hash ${newHash}, read ${afterUpgrade}.`,
      );
    }
    console.info("Asserted: executor now runs the rebuilt WASM.");

    // 2. Teardown — roll back to the canonical WASM (already on-chain).
    console.info("\n[2/2] Rolling back to original WASM (teardown)...");
    const rollbackPayload =
      executor.generateUpgradeExecutorPayload(originalHash);
    const rollbackVaa = await signGovernanceVaa(
      rollbackPayload,
      emitterPath,
      guardianCluster,
    );
    const rollbackTx = await dispatchGovernance(
      executor,
      privateKey,
      rollbackVaa,
    );
    console.info(`Dispatched: ${txUrl(chain, rollbackTx)}`);

    const afterRollback = await executor.getCurrentWasmHash();
    if (afterRollback !== originalHash) {
      throw new Error(
        `Teardown failed: expected WASM hash ${originalHash}, read ${afterRollback}.`,
      );
    }
    console.info("Asserted: executor restored to original WASM.");
    console.info("\ntest-upgrade: PASS");
  },
);

await parser.parseAsync();
