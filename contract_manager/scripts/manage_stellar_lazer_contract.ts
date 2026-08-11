/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import { parseVaa } from "@certusone/wormhole-sdk";
import type { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client";
import {
  CallStellarExecutor,
  decodeGovernancePayload,
  UpgradeStellarExecutor,
  WORMHOLE_API_ENDPOINT,
} from "@pythnetwork/xc-admin-common";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { getDefaultDeploymentConfig, toPrivateKey } from "../src/core/base";
import {
  StellarExecutorContract,
  StellarLazerContract,
} from "../src/core/contracts";
import type { Vault } from "../src/node/utils/governance";
import {
  loadHotWallet,
  SubmittedWormholeMessage,
} from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

function getMainnetVault(): Vault {
  const vault = Object.entries(DefaultStore.vaults).find(([id]) =>
    id.startsWith("mainnet-beta_"),
  )?.[1];
  if (!vault) {
    throw new Error("Could not find mainnet vault.");
  }
  return vault;
}

function connectMainnetVault(wallet: Wallet): Vault {
  // Override these URLs to use a different RPC node for mainnet / testnet.
  const RPCS = {
    devnet: "https://api.devnet.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
    testnet: "https://api.testnet.solana.com",
  } as Record<PythCluster, string>;

  const vault = getMainnetVault();
  vault.connect(wallet, (rpc) => RPCS[rpc]);
  return vault;
}

/** Fetch the guardian set the Wormhole mainnet guardians are currently signing with. */
async function fetchLiveMainnetGuardianSet(): Promise<{
  index: number;
  addresses: string[];
}> {
  const endpoint = WORMHOLE_API_ENDPOINT["mainnet-beta"];
  const response = await fetch(`${endpoint}/v1/guardianset/current`);
  const { guardianSet } = (await response.json()) as {
    guardianSet: { index: number; addresses: string[] };
  };
  return guardianSet;
}

/**
 * Report whether an on-chain value matches the canonical one, echoing both so the
 * output stands on its own as an audit record. Returns the verdict so the caller
 * can fail the command after running every check rather than at the first one.
 */
function check(label: string, actual: string, expected: string): boolean {
  const passed = actual.toLowerCase() === expected.toLowerCase();
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  console.log(`      on-chain: ${actual}`);
  console.log(`      expected: ${expected}`);
  return passed;
}

/** Build a proposal carrying a single Wormhole governance payload. */
async function propose(walletPath: string, payload: Buffer) {
  const wallet = await loadHotWallet(walletPath);
  const vault = connectMainnetVault(wallet);
  console.info("Using wallet:", wallet.publicKey.toBase58());
  console.info("Using vault for proposal:", vault.getId());

  console.info("Submitting governance proposal...");
  const proposal = await vault.proposeWormholeMessage([payload]);
  console.log("Proposal address:", proposal.address.toBase58());
}

const commonOptions = {
  executor: {
    coerce: (id: string) => {
      const contract = DefaultStore.executor_contracts[id];
      if (!(contract instanceof StellarExecutorContract)) {
        throw new TypeError(`ID '${id}' is not a Stellar executor contract.`);
      }
      return contract;
    },
    demandOption: true,
    description: "Executor contract ID in StellarExecutorContracts.json",
    type: "string",
  },
  "ops-key-path": {
    demandOption: true,
    description: "path to the Solana wallet used to create the DAO proposal",
    type: "string",
  },
  "private-key": {
    demandOption: true,
    description:
      "32-byte ed25519 seed (hex, no 0x) of the Stellar account paying tx fees",
    type: "string",
  },
  verifier: {
    coerce: (id: string) => {
      const contract = DefaultStore.lazer_contracts[id];
      if (!(contract instanceof StellarLazerContract)) {
        throw new TypeError(`ID '${id}' is not a Stellar Lazer contract.`);
      }
      return contract;
    },
    demandOption: true,
    description: "Verifier contract ID in StellarLazerContracts.json",
    type: "string",
  },
  "wasm-hash": {
    demandOption: true,
    description: "32-byte WASM hash of the new contract (hex, no 0x)",
    type: "string",
  },
} as const satisfies Record<string, Options>;

const parser = yargs(hideBin(process.argv))
  .usage(
    "Vault-based (DAO Squads multisig) management of Stellar PythLazer contracts.",
  )
  .strict()
  .demandCommand(1);

parser.command(
  "propose-update-trusted-signer",
  "propose a trusted-signer update through the DAO vault",
  (b) =>
    b.options({
      "expires-at": {
        coerce: BigInt,
        demandOption: true,
        description:
          "expiry timestamp (unix seconds); 0 removes the trusted signer",
        type: "string",
      },
      "ops-key-path": commonOptions["ops-key-path"],
      "trusted-signer": {
        demandOption: true,
        description: "33-byte compressed secp256k1 signer key (hex, no 0x)",
        type: "string",
      },
      verifier: commonOptions.verifier,
    }),
  async (argv) => {
    const payload = await argv.verifier.generateUpdateTrustedSignerPayload(
      argv["trusted-signer"],
      argv["expires-at"],
    );
    await propose(argv["ops-key-path"], payload);
  },
);

parser.command(
  "propose-upgrade-verifier",
  "propose a verifier WASM upgrade through the DAO vault",
  (b) =>
    b.options({
      "ops-key-path": commonOptions["ops-key-path"],
      verifier: commonOptions.verifier,
      "wasm-hash": commonOptions["wasm-hash"],
    }),
  async (argv) => {
    const payload = await argv.verifier.generateUpgradeVerifierPayload(
      argv["wasm-hash"],
    );
    await propose(argv["ops-key-path"], payload);
  },
);

parser.command(
  "propose-upgrade-executor",
  "propose an executor self-upgrade through the DAO vault",
  (b) =>
    b.options({
      executor: commonOptions.executor,
      "ops-key-path": commonOptions["ops-key-path"],
      "wasm-hash": commonOptions["wasm-hash"],
    }),
  async (argv) => {
    const payload = argv.executor.generateUpgradeExecutorPayload(
      argv["wasm-hash"],
    );
    await propose(argv["ops-key-path"], payload);
  },
);

parser.command(
  "execute-proposals",
  "submit DAO-approved governance VAAs to the executor (run after the DAO votes)",
  (b) =>
    b.options({
      executor: commonOptions.executor,
      "private-key": commonOptions["private-key"],
      since: {
        description:
          "Wormhole sequence to start scanning from (inclusive). Defaults to the executor's last executed sequence + 1; pass it explicitly to avoid scanning from the beginning.",
        type: "number",
      },
    }),
  async (argv) => {
    const executor = argv.executor;
    const vault = getMainnetVault();
    const emitter = await vault.getEmitter();
    const targetChain = executor.chain.wormholeChainName;

    const since =
      argv.since ?? Number(await executor.getLastExecutedSequence()) + 1;
    console.info(
      `Scanning vault ${vault.getId()} from sequence ${since.toString()} for '${targetChain}' proposals...`,
    );

    for (let i = since; ; i++) {
      const ref = new SubmittedWormholeMessage(emitter, i, vault.cluster);
      let vaa: Buffer;
      try {
        vaa = await ref.fetchVaa();
      } catch {
        console.warn(`Could not find VAA #${i.toString()}, ending.`);
        break;
      }

      const action = decodeGovernancePayload(parseVaa(vaa).payload);
      if (!action) {
        console.warn(`Could not parse VAA #${i.toString()}, skipping...`);
        continue;
      }
      if (action.targetChainId !== targetChain) {
        console.warn(
          `VAA #${i.toString()} targets '${action.targetChainId}', not '${targetChain}', skipping...`,
        );
        continue;
      }
      if (
        !(
          action instanceof CallStellarExecutor ||
          action instanceof UpgradeStellarExecutor
        )
      ) {
        console.warn(
          `VAA #${i.toString()} is not a Stellar executor action, skipping...`,
        );
        continue;
      }

      console.info(`Submitting governance VAA #${i.toString()}...`);
      const result = await executor.executeGovernanceAction(
        toPrivateKey(argv["private-key"]),
        vaa,
      );
      console.info(`  Transaction finished: ${result.id}`);
    }
  },
);

parser.command(
  "upgrade-guardian-set",
  "advance the executor's stored Wormhole guardian set to the current mainnet set",
  (b) =>
    b.options({
      executor: commonOptions.executor,
      "private-key": commonOptions["private-key"],
    }),
  async (argv) => {
    const executor = argv.executor;
    const before = await executor.getCurrentGuardianSetIndex();
    console.info(`Current guardian set index: ${before.toString()}`);
    await executor.syncMainnetGuardianSets(toPrivateKey(argv["private-key"]));
    const after = await executor.getCurrentGuardianSetIndex();
    console.info(`Guardian set index is now: ${after.toString()}`);
  },
);

parser.command(
  "show-guardian-set",
  "show the executor's stored guardian set index against the live mainnet index",
  (b) =>
    b.options({
      executor: commonOptions.executor,
    }),
  async (argv) => {
    const executor = argv.executor;
    const index = await executor.getCurrentGuardianSetIndex();
    const guardians = await executor.getGuardianSet();
    console.log(`Executor stored guardian set index: ${index.toString()}`);
    console.log(`  guardians (${guardians.length.toString()}):`);
    for (const guardian of guardians) {
      console.log(`    ${guardian}`);
    }

    const guardianSet = await fetchLiveMainnetGuardianSet();
    console.log(
      `Live mainnet guardian set index: ${guardianSet.index.toString()}`,
    );
    if (index === guardianSet.index) {
      console.log("Executor is up to date.");
    } else {
      console.log(
        `Executor is ${(guardianSet.index - index).toString()} set(s) behind; run upgrade-guardian-set.`,
      );
    }
  },
);

parser.command(
  "verify-deployment",
  "audit a deployed executor + verifier pair against the canonical Pyth-DAO governance configuration",
  (b) =>
    b.options({
      executor: commonOptions.executor,
      verifier: commonOptions.verifier,
    }),
  async (argv) => {
    const { executor, verifier } = argv;
    if (executor.chain.getId() !== verifier.chain.getId()) {
      throw new Error(
        `Executor is on ${executor.chain.getId()} but verifier is on ${verifier.chain.getId()}.`,
      );
    }

    console.log(`Chain:    ${executor.chain.getId()}`);
    console.log(`Executor: ${executor.address}`);
    console.log(`Verifier: ${verifier.address}\n`);

    const { governanceDataSource, wormholeConfig } =
      getDefaultDeploymentConfig("stable");
    const config = await executor.getConfig();
    const guardianSet = await fetchLiveMainnetGuardianSet();
    const vault = getMainnetVault();
    const daoEmitter = await vault.getEmitter();

    const results = [
      check(
        "verifier authorizes the registered executor",
        await verifier.getExecutor(),
        executor.address,
      ),
      check(
        "Pyth receiver chain id (governance targets this exact id)",
        config.chainId.toString(),
        executor.chain.getWormholeChainId().toString(),
      ),
      check(
        "governance (owner) emitter chain",
        config.ownerEmitterChain.toString(),
        governanceDataSource.emitterChain.toString(),
      ),
      check(
        "governance (owner) emitter address",
        config.ownerEmitterAddress,
        governanceDataSource.emitterAddress,
      ),
      // The same address again, but derived live from the DAO Squads multisig
      // rather than read from this repo's constants — this is what proves only
      // the DAO can produce a governance VAA the executor accepts.
      check(
        `governance emitter is the Wormhole emitter of DAO vault ${vault.getId()}`,
        config.ownerEmitterAddress,
        daoEmitter.toBuffer().toString("hex"),
      ),
      check(
        "guardian-set-upgrade emitter chain",
        config.gsUpgradeEmitterChain.toString(),
        wormholeConfig.governanceChainId.toString(),
      ),
      check(
        "guardian-set-upgrade emitter address (Wormhole core bridge)",
        config.gsUpgradeEmitterAddress,
        wormholeConfig.governanceContract,
      ),
      check(
        "guardian set index matches the live Wormhole mainnet set",
        (await executor.getCurrentGuardianSetIndex()).toString(),
        guardianSet.index.toString(),
      ),
      check(
        "guardian set members match the live Wormhole mainnet set",
        (await executor.getGuardianSet()).join(","),
        guardianSet.addresses.join(","),
      ),
    ];

    // The trusted signer set has no canonical off-chain constant to diff
    // against, so it is reported rather than compared. `verify_update` against a
    // live Lazer message is what proves the set is the right one — the contract
    // only returns a payload if it was signed by a trusted, unexpired signer.
    const now = BigInt(Math.floor(Date.now() / 1000));
    const signers = await verifier.getTrustedSigners();
    console.log(`Trusted Lazer signers (${signers.length.toString()}):`);
    for (const { expiresAt, publicKey } of signers) {
      const expiry = new Date(Number(expiresAt) * 1000).toISOString();
      console.log(
        `      ${publicKey} expires ${expiry} ${expiresAt > now ? "(active)" : "(EXPIRED)"}`,
      );
    }
    results.push(
      check(
        "verifier has at least one unexpired trusted Lazer signer",
        signers.some(({ expiresAt }) => expiresAt > now).toString(),
        "true",
      ),
    );

    const failed = results.filter((passed) => !passed).length;
    if (failed > 0) {
      throw new Error(`${failed.toString()} check(s) FAILED.`);
    }
    console.log(`\nAll ${results.length.toString()} checks passed.`);
  },
);

await parser.parseAsync();
