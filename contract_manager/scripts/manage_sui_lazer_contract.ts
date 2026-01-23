/* eslint-disable no-console */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Wallet } from "@coral-xyz/anchor";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { PythCluster } from "@pythnetwork/client";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import * as micromustache from "micromustache";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { SuiLazerMeta } from "../src/core/chains";
import { SuiChain } from "../src/core/chains";
import { SuiLazerContract } from "../src/core/contracts";
import { loadHotWallet, WormholeEmitter } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

function updateContractInStore(contract: SuiLazerContract) {
  DefaultStore.lazer_contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
}

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
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
    testnet: "https://api.testnet.solana.com",
    devnet: "https://api.devnet.solana.com",
  } as Record<PythCluster, string>;

  const vault = getMainnetVault();
  vault.connect(wallet, (rpc) => RPCS[rpc]);

  return vault;
}

async function updateContractMeta(packagePath: string, meta: SuiLazerMeta) {
  const templatePath = path.resolve(packagePath, "sources/meta.move.mustache");
  const template = await readFile(templatePath, { encoding: "utf8" });
  const outputPath = path.resolve(packagePath, "sources/meta.move");
  const output = micromustache.render(template, meta);
  await writeFile(outputPath, output, { encoding: "utf8" });
}

/**
 * Bumps contract version in source based on on-chain version and returns new
 * contract metadata.
 */
async function fetchAndBumpContractMeta(
  chain: SuiChain,
  contract: SuiLazerContract,
  packagePath: string,
): Promise<SuiLazerMeta> {
  const { version } = await chain.getStatePackageInfo(
    chain.getProvider(),
    contract.stateId,
  );
  const meta = {
    version: (BigInt(version) + 1n).toString(),
    receiver_chain_id: chain.getWormholeChainId(),
  };
  await updateContractMeta(packagePath, meta);
  return meta;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const parser = yargs()
  .usage("Deployment, upgrades and management of Sui PythLazer contracts.")
  .options({
    chain: {
      type: "string",
      alias: "c",
      description: "chain name to deploy to (from SuiChains.json)",
      demandOption: true,
      coerce: (name: string) => {
        if (DefaultStore.chains[name] instanceof SuiChain) {
          return DefaultStore.chains[name];
        } else {
          throw new TypeError(`Not a valid Sui chain: ${name}`);
        }
      },
    },
  })
  .strict()
  .demandCommand(1);

const commonOptions = {
  "private-key": {
    type: "string",
    description: "Bech32 private key to use for transactions",
    demandOption: true,
  },
  wormhole: {
    type: "string",
    description: "Wormhole state object ID",
    demandOption: true,
  },
  state: {
    type: "string",
    description: "State object ID",
    demandOption: true,
  },
  emitter: {
    type: "string",
    description: "path to a solana wallet used as an emitter",
    demandOption: true,
  },
  packagePath: {
    type: "string",
    description: "path to Sui Move package",
    demandOption: true,
    default: path.resolve(scriptDir, "../../lazer/contracts/sui"),
  },
  contract: {
    type: "string",
    description: "Contract ID in SuiLazerContracts.json",
    demandOption: true,
    coerce: (id: string) => {
      const contract = DefaultStore.lazer_contracts[id];
      if (!(contract instanceof SuiLazerContract)) {
        throw new TypeError(`ID '${id}' is not a Sui Lazer contract.`);
      }
      return contract;
    },
  },
} as const satisfies Record<string, Options>;

parser.command(
  "deploy",
  "deploy contract to a selected chain",
  (b) =>
    b.options({
      "private-key": commonOptions["private-key"],
      path: commonOptions.packagePath,
      wormhole: commonOptions.wormhole,
      "governance-chain": {
        type: "number",
        description: "Wormhole chain ID where the governance is located",
        demandOption: true,
        default: CHAINS.solana,
      },
      "governance-address": {
        type: "string",
        description: "address of the governance contract on its chain",
      },
      "upgrade-cap": {
        type: "string",
        description: "existing UpgradeCap ID to use instead of publishing",
      },
    }),
  async ({
    chain,
    privateKey,
    path: packagePath,
    wormhole: wormholeStateId,
    governanceChain,
    governanceAddress,
    upgradeCap: existingUpgradeCapId,
  }) => {
    if (!governanceAddress) {
      if (governanceChain == CHAINS.solana) {
        const emitterKey = await getMainnetVault().getEmitter();
        governanceAddress = emitterKey.toBase58();
        console.info("Using mainnet vault as an emitter:", governanceAddress);
      } else {
        throw new Error(
          `Missing governance address for selected chain '${governanceChain.toString()}'`,
        );
      }
    }

    console.info(`Checking Wormhole state ${wormholeStateId}...`);
    const { package: wormholeId } = await chain.getStatePackageInfo(
      chain.getProvider(),
      wormholeStateId,
    );
    console.info(`Found Wormhole package: ${wormholeId}`);

    const signer = Ed25519Keypair.fromSecretKey(privateKey);
    console.info(`Deploying '${packagePath}' to '${chain.getId()}':`);

    let packageId: string;
    let upgradeCapId: string;
    if (existingUpgradeCapId) {
      console.info("Got UpgradeCap ID, finding existing package...");
      packageId = await chain.getUpgradeCapPackage(existingUpgradeCapId);
      upgradeCapId = existingUpgradeCapId;
      console.info("Found package:");
    } else {
      console.info("Initializing package metadata...");
      const meta = {
        version: "1",
        receiver_chain_id: chain.getWormholeChainId(),
      };
      await updateContractMeta(packagePath, meta);

      console.info("Building package...");
      const pkg = await chain.buildPackage(packagePath);
      const digest = Buffer.from(pkg.digest).toString("hex");
      console.info(`Package digest: ${digest}`);

      console.info("Publishing package...");
      ({ packageId, upgradeCapId } = await chain.publishLazerPackage(
        pkg,
        meta,
        signer,
      ));
      console.info("Package published:");
    }
    console.info(`  package: ${chain.explorerUrl("object", packageId)}`);
    console.info(`  UpgradeCap: ${chain.explorerUrl("object", upgradeCapId)}`);

    console.info("Initializing package state...");
    const { stateId } = await chain.initLazerContract(
      packageId,
      upgradeCapId,
      {
        emitterChain: governanceChain,
        emitterAddress: governanceAddress,
      },
      signer,
    );
    console.info("Package state initialized:");
    console.info(`  State: ${chain.explorerUrl("object", stateId)}`);

    console.info("Saving initialized contract in store...");
    const contract = new SuiLazerContract(chain, stateId, wormholeStateId);
    updateContractInStore(contract);
    console.info(`Contract ID: ${contract.getId()}`);
  },
);

parser.command(
  "update-contract-meta",
  "updates `meta` module in package source using current on-chain contract",
  (b) =>
    b.options({
      path: commonOptions.packagePath,
      contract: commonOptions.contract,
    }),
  async ({ chain, path: packagePath, contract }) => {
    const { version } = await chain.getStatePackageInfo(
      chain.getProvider(),
      contract.stateId,
    );
    await updateContractMeta(packagePath, {
      version,
      receiver_chain_id: chain.getWormholeChainId(),
    });
  },
);

parser.command(
  "test-upgrade",
  "upgrade specified test contract",
  (b) =>
    b.options({
      "private-key": commonOptions["private-key"],
      path: commonOptions.packagePath,
      contract: commonOptions.contract,
      emitter: commonOptions.emitter,
    }),
  async ({
    chain,
    privateKey,
    path: packagePath,
    contract,
    emitter: emitterPath,
  }) => {
    const emitterWallet = await loadHotWallet(emitterPath);
    const emitter = new WormholeEmitter("devnet", emitterWallet);
    const signer = Ed25519Keypair.fromSecretKey(privateKey);

    console.info("Upgrading package...");

    console.info("Updating package metadata...");
    const meta = await fetchAndBumpContractMeta(chain, contract, packagePath);

    console.info("Building package update...");
    const pkg = await chain.buildPackage(packagePath);
    const digest = Buffer.from(pkg.digest).toString("hex");
    console.info(`Package update digest: ${digest}`);

    console.info("Submitting governance message to Wormhole...");
    const payload = chain.generateGovernanceUpgradeLazerPayload(
      BigInt(meta.version),
      digest,
    );
    const submitted = await emitter.sendMessage(payload);

    console.info(
      `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
    );
    const vaa = await submitted.fetchVaa(10);

    console.info("Performing signed upgrade...");
    const upgradeDigest = await chain.upgradeLazerContract({
      stateId: contract.stateId,
      wormholeStateId: contract.wormholeStateId,
      pkg,
      meta,
      vaa,
      signer,
    });

    console.info(
      `Transaction finished: ${chain.explorerUrl("txblock", upgradeDigest)}`,
    );
  },
);

parser.command(
  "test-update-trusted-signer",
  "update trusted signer in a test contract",
  (b) =>
    b.options({
      "private-key": commonOptions["private-key"],
      contract: commonOptions.contract,
      emitter: commonOptions.emitter,
      signer: {
        type: "string",
        description: "trusted signer to update",
        demandOption: true,
      },
      expires: {
        type: "string",
        description: "timestamp of expiration in seconds",
        demandOption: true,
        coerce: BigInt,
      },
    }),
  async ({
    chain,
    privateKey,
    contract,
    emitter: emitterPath,
    signer: trustedSigner,
    expires,
  }) => {
    const emitterWallet = await loadHotWallet(emitterPath);
    const emitter = new WormholeEmitter("devnet", emitterWallet);
    const signer = Ed25519Keypair.fromSecretKey(privateKey);

    console.info(
      `Adding trusted signer ${emitter.wallet.publicKey.toBase58()} ...`,
    );

    console.info("Submitting governance message to Wormhole...");
    const payload = chain.generateGovernanceUpdateTrustedSignerPayload(
      trustedSigner,
      expires,
    );
    const submitted = await emitter.sendMessage(payload);

    console.info(
      `Awaiting signed VAA #${submitted.sequenceNumber.toString()}...`,
    );
    const vaa = await submitted.fetchVaa(10);

    console.info("Performing signed update...");
    const digest = await chain.updateTrustedSigner({
      stateId: contract.stateId,
      wormholeStateId: contract.wormholeStateId,
      vaa,
      signer,
    });

    console.info(
      `Transaction finished: ${chain.explorerUrl("txblock", digest)}`,
    );
  },
);

parser.command(
  "propose-upgrade",
  "propose upgrade of a specified contract to governance",
  (b) =>
    b.options({
      path: commonOptions.packagePath,
      contract: commonOptions.contract,
      wallet: {
        type: "string",
        description: "path to solana wallet used for creating a proposal",
        demandOption: true,
      },
    }),
  async ({ chain, path: packagePath, contract, wallet: walletPath }) => {
    const wallet = await loadHotWallet(walletPath);
    const vault = connectMainnetVault(wallet);
    console.info("Using wallet:", wallet.publicKey.toBase58());

    console.info("Creating package upgrade proposal...");

    console.info("Updating package metadata...");
    const { version } = await fetchAndBumpContractMeta(
      chain,
      contract,
      packagePath,
    );

    console.info("Building package update...");
    const pkg = await chain.buildPackage(packagePath);
    const digest = Buffer.from(pkg.digest).toString("hex");
    console.info(`Package update digest: ${digest}`);

    console.info("Submitting governance proposal...");
    const payload = chain.generateGovernanceUpgradeLazerPayload(
      BigInt(version),
      digest,
    );
    const proposal = await vault.proposeWormholeMessage([payload]);
    console.log("Proposal address:", proposal.address.toBase58());
  },
);

await parser.parseAsync(hideBin(process.argv));
