/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */

import type { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client";
import {
  decodeGovernancePayload,
  UpdateTrustedSigner256Bit,
  UpgradeCardanoSpendScript,
  UpgradeCardanoWithdrawScript,
} from "@pythnetwork/xc-admin-common";
import { deserialize } from "@wormhole-foundation/sdk-definitions";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  loadHotWallet,
  SubmittedWormholeMessage,
  WormholeEmitter,
} from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

function getMainnetVault() {
  const vault = Object.entries(DefaultStore.vaults).find(([id]) =>
    id.startsWith("mainnet-beta_"),
  )?.[1];
  if (!vault) {
    throw new Error("Could not find mainnet vault.");
  }
  return vault;
}

function connectMainnetVault(wallet: Wallet) {
  // Override these URLs to use a different RPC node for mainnet / testnet.
  // TODO: extract these RPCs to a config file (?)
  const RPCS = {
    devnet: "https://api.devnet.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
    testnet: "https://api.testnet.solana.com",
  } as Record<PythCluster, string>;

  const vault = getMainnetVault();
  vault.connect(wallet, (rpc) => RPCS[rpc]);

  return vault;
}

const parser = yargs()
  .usage("Governance proposals generation for Cardano")
  .options({
    chain: {
      alias: "c",
      choices: [
        "cardano_mainnet",
        "cardano_preprod",
        "cardano_preview",
      ] as const,
      demandOption: true,
      description: "chain name to deploy to",
    },
  })
  .strict()
  .demandCommand(1);

const commonOptions = {
  emitter: {
    demandOption: true,
    description: "path to a solana wallet used as an emitter",
    type: "string",
  },
  expires: {
    coerce: BigInt,
    demandOption: true,
    description: "timestamp of expiration in seconds",
    type: "string",
  },
  script: {
    demandOption: true,
    description: "script hash",
    type: "string",
  },
  "solana-wallet": {
    demandOption: true,
    description: "path to solana wallet used for creating a proposal",
    type: "string",
  },
  "trusted-signer": {
    demandOption: true,
    description: "trusted signer to update",
    type: "string",
  },
} as const satisfies Record<string, Options>;

parser.command(
  "test-update-trusted-signer",
  "create VAA for updating trusted signer in a test contract",
  (b) =>
    b.options({
      emitter: commonOptions.emitter,
      expires: commonOptions.expires,
      signer: commonOptions["trusted-signer"],
    }),
  async ({ chain, emitter: emitterPath, expires, signer: trustedSigner }) => {
    const emitterWallet = await loadHotWallet(emitterPath);
    const emitter = new WormholeEmitter("devnet", emitterWallet);
    console.info("Using wallet:", emitterWallet.publicKey.toBase58());

    console.info("Submitting governance message to Wormhole...");
    const payload = new UpdateTrustedSigner256Bit(
      chain,
      trustedSigner,
      expires,
    ).encode();
    const submitted = await emitter.sendMessage(payload);

    console.info(
      `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
    );
    const vaa = await submitted.fetchVaa(10);

    console.info(
      `VAA ID: "1/${submitted.emitter.toBuffer().toString("hex")}/${submitted.sequenceNumber}"`,
    );
    console.info("VAA:", JSON.stringify(vaa.toString("hex")));
  },
);

parser.command(
  "test-upgrade-spend-script",
  "create VAA for upgrading a spending script in a test contract",
  (b) =>
    b.options({
      emitter: commonOptions.emitter,
      script: commonOptions.script,
    }),
  async ({ chain, emitter: emitterPath, script }) => {
    const emitterWallet = await loadHotWallet(emitterPath);
    const emitter = new WormholeEmitter("devnet", emitterWallet);
    console.info("Using wallet:", emitterWallet.publicKey.toBase58());

    console.info("Submitting governance message to Wormhole...");
    const payload = new UpgradeCardanoSpendScript(chain, script).encode();
    const submitted = await emitter.sendMessage(payload);

    console.info(
      `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
    );
    const vaa = await submitted.fetchVaa(10);

    console.info(
      `VAA ID: "1/${submitted.emitter.toBuffer().toString("hex")}/${submitted.sequenceNumber}"`,
    );
    console.info("VAA:", JSON.stringify(vaa.toString("hex")));
  },
);

parser.command(
  "test-upgrade-withdraw-script",
  "create VAA for upgrading a withdrawing script in a test contract",
  (b) =>
    b.options({
      emitter: commonOptions.emitter,
      expires: commonOptions.expires,
      script: commonOptions.script,
    }),
  async ({ chain, emitter: emitterPath, expires, script }) => {
    const emitterWallet = await loadHotWallet(emitterPath);
    const emitter = new WormholeEmitter("devnet", emitterWallet);
    console.info("Using wallet:", emitterWallet.publicKey.toBase58());

    console.info("Submitting governance message to Wormhole...");
    const payload = new UpgradeCardanoWithdrawScript(
      chain,
      script,
      expires,
    ).encode();
    const submitted = await emitter.sendMessage(payload);

    console.info(
      `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
    );
    const vaa = await submitted.fetchVaa(10);

    console.info(
      `VAA ID: "1/${submitted.emitter.toBuffer().toString("hex")}/${submitted.sequenceNumber}"`,
    );
    console.info("VAA:", JSON.stringify(vaa.toString("hex")));
  },
);

parser.command(
  "propose-update-trusted-signer",
  "propose update of a trusted signer",
  (b) =>
    b.options({
      expires: commonOptions.expires,
      signer: commonOptions["trusted-signer"],
      wallet: commonOptions["solana-wallet"],
    }),
  async ({ chain, signer: trustedSigner, expires, wallet: walletPath }) => {
    const wallet = await loadHotWallet(walletPath);
    const vault = connectMainnetVault(wallet);
    console.info("Using wallet:", wallet.publicKey.toBase58());

    console.info("Submitting governance proposal...");
    const payload = new UpdateTrustedSigner256Bit(
      chain,
      trustedSigner,
      expires,
    ).encode();
    const proposal = await vault.proposeWormholeMessage([payload]);
    console.log("Proposal address:", proposal.address.toBase58());
  },
);

parser.command(
  "propose-upgrade-spend-script",
  "propose upgrade of a spending script",
  (b) =>
    b.options({
      script: commonOptions.script,
      wallet: commonOptions["solana-wallet"],
    }),
  async ({ chain, script, wallet: walletPath }) => {
    const wallet = await loadHotWallet(walletPath);
    const vault = connectMainnetVault(wallet);
    console.info("Using wallet:", wallet.publicKey.toBase58());

    console.info("Submitting governance proposal...");
    const payload = new UpgradeCardanoSpendScript(chain, script).encode();
    const proposal = await vault.proposeWormholeMessage([payload]);
    console.log("Proposal address:", proposal.address.toBase58());
  },
);

parser.command(
  "propose-upgrade-withdraw-script",
  "propose upgrade of a withdrawing script",
  (b) =>
    b.options({
      expires: commonOptions.expires,
      script: commonOptions.script,
      wallet: commonOptions["solana-wallet"],
    }),
  async ({ chain, expires, script, wallet: walletPath }) => {
    const wallet = await loadHotWallet(walletPath);
    const vault = connectMainnetVault(wallet);
    console.info("Using wallet:", wallet.publicKey.toBase58());

    console.info("Submitting governance proposal...");
    const payload = new UpgradeCardanoWithdrawScript(
      chain,
      script,
      expires,
    ).encode();
    const proposal = await vault.proposeWormholeMessage([payload]);
    console.log("Proposal address:", proposal.address.toBase58());
  },
);

parser.command(
  "fetch-vaas",
  "fetch hex-encoded VAAs targeting the specified chain since a given sequence number",
  (b) =>
    b.options({
      since: {
        coerce: Number,
        demandOption: true,
        description: "sequence number to start fetching from (inclusive)",
        type: "number",
      },
    }),
  async ({ chain, since }) => {
    const vault = getMainnetVault();
    const emitter = await vault.getEmitter();
    const lastSequence = await vault.getLastSequenceNumber();

    process.stderr.write(
      `Fetching sequences ${since}..${lastSequence} from emitter ${emitter.toBase58()}\n`,
    );

    for (let seq = since; seq <= lastSequence; seq++) {
      const msg = new SubmittedWormholeMessage(emitter, seq, vault.cluster);
      let vaa: Buffer;
      try {
        vaa = await msg.fetchVaa(10);
      } catch {
        process.stderr.write(`Sequence ${seq}: not found, skipping\n`);
        continue;
      }
      const { payload } = deserialize("Uint8Array", new Uint8Array(vaa));
      const action = decodeGovernancePayload(Buffer.from(payload));
      if (!action || action.targetChainId !== chain) {
        process.stderr.write(
          `Sequence ${seq}: could not decode as action for this chain, skipping\n`,
        );
        continue;
      }
      process.stdout.write(`${vaa.toString("hex")}\n`);
    }
  },
);

await parser.parseAsync(hideBin(process.argv));
