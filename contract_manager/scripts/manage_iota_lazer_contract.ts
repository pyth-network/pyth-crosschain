/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Wallet } from "@coral-xyz/anchor";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import type { PythCluster } from "@pythnetwork/client";
import { CHAINS } from "@pythnetwork/xc-admin-common";
import type { Options } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { getDefaultDeploymentConfig } from "../src/core/base";
import { IotaChain } from "../src/core/chains";
import { IotaLazerContract, IotaWormholeContract } from "../src/core/contracts";
import { loadHotWallet, WormholeEmitter } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

function updateContractInStore(contract: IotaLazerContract) {
  DefaultStore.lazer_contracts[contract.getId()] = contract;
  DefaultStore.saveAllContracts();
}

function updateWormholeContractInStore(contract: IotaWormholeContract) {
  DefaultStore.wormhole_contracts[contract.getId()] = contract;
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
    devnet: "https://api.devnet.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
    testnet: "https://api.testnet.solana.com",
  } as Record<PythCluster, string>;

  const vault = getMainnetVault();
  vault.connect(wallet, (rpc) => RPCS[rpc]);

  return vault;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const WORMHOLE_GUARDIAN_SET_VAAS_URL =
  "https://raw.githubusercontent.com/wormhole-foundation/wormhole/refs/heads/main/guardianset/mainnetv2/canonical_sets/guardianSetVAAs.csv";

type GuardianSetUpgrade = {
  index: number;
  vaa: Buffer;
};

function parseGuardianSetUpgrade(
  label: string,
  vaaHex: string,
): GuardianSetUpgrade {
  const match = /^gs([1-9]\d*)$/.exec(label);
  if (!match?.[1]) {
    throw new Error(`Invalid guardian-set label '${label}'`);
  }
  return { index: Number.parseInt(match[1]), vaa: Buffer.from(vaaHex, "hex") };
}

async function fetchGuardianSetUpgrades(): Promise<GuardianSetUpgrade[]> {
  const response = await fetch(WORMHOLE_GUARDIAN_SET_VAAS_URL);
  if (!response.ok) {
    throw new Error(
      `Guardian-set VAA fetch failed: ${response.status.toString()} ${response.statusText}`,
    );
  }
  const csv = (await response.text()).trim();
  if (csv.length === 0) {
    throw new Error("Guardian-set VAA response is empty");
  }
  return csv.split(/\r?\n/).map((line, position) => {
    const parts = line.trim().split(",");
    if (!parts[0] || !parts[1]) {
      throw new Error(
        `Invalid guardian-set VAA CSV row ${(position + 1).toString()}`,
      );
    }
    return parseGuardianSetUpgrade(parts[0], parts[1]);
  });
}

async function applyGuardianSetUpgrades(
  chain: IotaChain,
  signer: Ed25519Keypair,
  stateId: string,
  upgrades: GuardianSetUpgrade[],
) {
  for (const upgrade of upgrades) {
    console.info(`Applying guardian set ${upgrade.index.toString()}...`);
    const digest = await chain.updateWormholeGuardianSet({
      signer,
      stateId,
      vaa: upgrade.vaa,
    });
    await chain.waitForTransaction(digest);
    console.info(`  transaction: ${chain.explorerUrl("txblock", digest)}`);
  }
}

function getWormholeVendorPath(chain: IotaChain) {
  const network = chain.wormholeChainName.replace(/^iota_sui_/, "");
  if (network === chain.wormholeChainName) {
    throw new Error(
      `Cannot derive Wormhole vendor from chain name '${chain.wormholeChainName}'`,
    );
  }
  return path.resolve(
    scriptDir,
    `../../lazer/contracts/iota/vendor/wormhole_${network}`,
  );
}

const parser = yargs()
  .usage("Deployment, upgrades and management of IOTA PythLazer contracts.")
  .options({
    chain: {
      alias: "c",
      coerce: (name: string) => {
        if (DefaultStore.chains[name] instanceof IotaChain) {
          return DefaultStore.chains[name];
        } else {
          throw new TypeError(`Not a valid IOTA chain: ${name}`);
        }
      },
      demandOption: true,
      description: "chain name to deploy to (from IotaChains.json)",
      type: "string",
    },
  })
  .strict()
  .demandCommand(1);

const commonOptions = {
  contract: {
    coerce: (id: string) => {
      const contract = DefaultStore.lazer_contracts[id];
      if (!(contract instanceof IotaLazerContract)) {
        throw new TypeError(`ID '${id}' is not an IOTA Lazer contract.`);
      }
      return contract;
    },
    demandOption: true,
    description: "Contract ID in IotaLazerContracts.json",
    type: "string",
  },
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
  packagePath: {
    default: path.resolve(scriptDir, "../../lazer/contracts/iota"),
    demandOption: true,
    description: "path to IOTA Move package",
    type: "string",
  },
  "private-key": {
    demandOption: true,
    description: "Bech32 private key to use for transactions",
    type: "string",
  },
  "solana-wallet": {
    demandOption: true,
    description: "path to solana wallet used for creating a proposal",
    type: "string",
  },
  state: {
    demandOption: true,
    description: "State object ID",
    type: "string",
  },
  "trusted-signer": {
    demandOption: true,
    description: "trusted signer to update",
    type: "string",
  },
  wormhole: {
    demandOption: true,
    description: "Wormhole state object ID",
    type: "string",
  },
} as const satisfies Record<string, Options>;

parser.command(
  "deploy-wormhole",
  "build, publish, initialize and save the vendored Wormhole contract",
  (b) =>
    b.options({
      "governance-chain": {
        description: "override the Wormhole governance chain ID",
        type: "number",
      },
      "governance-emitter": {
        description: "override the 32-byte Wormhole governance emitter",
        type: "string",
      },
      "guardian-set-ttl": {
        description:
          "seconds a replaced guardian set remains valid for non-governance VAAs",
        required: true,
        type: "number",
      },
      "initial-guardian": {
        array: true,
        description:
          "override an initial 20-byte guardian address; repeat for each guardian",
        type: "string",
      },
      "private-key": commonOptions["private-key"],
      "upgrade-guardian-set": {
        description:
          "fetch and apply official guardian-set upgrade VAAs after initialization",
        type: "boolean",
      },
    }),
  async ({
    chain,
    governanceEmitter,
    governanceChain,
    guardianSetTtl,
    initialGuardian,
    privateKey,
    upgradeGuardianSet,
  }) => {
    const { wormholeConfig: defaults } = getDefaultDeploymentConfig("stable");
    const initialGuardians = initialGuardian ?? defaults.initialGuardianSet;
    const config = {
      governanceChain: governanceChain ?? defaults.governanceChainId,
      governanceEmitter: IotaChain.bytesFromHex(
        governanceEmitter ?? defaults.governanceContract,
        32,
        "Wormhole governance emitter",
      ),
      guardianSetSecondsToLive: guardianSetTtl,
      initialGuardians: initialGuardians.map((guardian, index) => [
        ...IotaChain.bytesFromHex(
          guardian,
          20,
          `Wormhole guardian ${index.toString()}`,
        ),
      ]),
    };
    const packagePath = getWormholeVendorPath(chain);
    const signer = Ed25519Keypair.fromSecretKey(privateKey);

    console.info(
      `Deploying vendored Wormhole '${packagePath}' to '${chain.getId()}'`,
    );
    console.info(`  governance chain: ${config.governanceChain.toString()}`);
    console.info(
      `  governance emitter: ${config.governanceEmitter.toString("hex")}`,
    );
    console.info(
      `  initial guardian set: ${config.initialGuardians.length.toString()} guardian(s)`,
    );
    console.info(
      `  expired guardian-set TTL: ${config.guardianSetSecondsToLive.toString()} seconds`,
    );

    console.info("Building vendored Wormhole package...");
    const pkg = await chain.buildWormholePackage(packagePath);
    console.info(`Package digest: ${Buffer.from(pkg.digest).toString("hex")}`);

    console.info("Publishing Wormhole package...");
    const published = await chain.publishWormholePackage(pkg, signer);
    console.info(
      `Publish transaction: ${chain.explorerUrl("txblock", published.digest)}`,
    );
    console.info(
      `  package: ${chain.explorerUrl("object", published.packageId)}`,
    );
    console.info(
      `  UpgradeCap: ${chain.explorerUrl("object", published.upgradeCapId)}`,
    );
    console.info(
      `  DeployerCap: ${chain.explorerUrl("object", published.deployerCapId)}`,
    );
    await chain.waitForTransaction(published.digest);

    console.info("Initializing Wormhole shared state...");
    const initialized = await chain.initWormholeContract({
      config,
      deployerCapId: published.deployerCapId,
      packageId: published.packageId,
      signer,
      upgradeCapId: published.upgradeCapId,
    });
    console.info(
      `Initialization transaction: ${chain.explorerUrl("txblock", initialized.digest)}`,
    );
    console.info(
      `  State: ${chain.explorerUrl("object", initialized.stateId)}`,
    );
    await chain.waitForTransaction(initialized.digest);

    if (upgradeGuardianSet) {
      console.info(
        `Fetching canonical guardian-set VAAs from ${WORMHOLE_GUARDIAN_SET_VAAS_URL}`,
      );
      const guardianSetUpgrades = await fetchGuardianSetUpgrades();
      console.info(
        `  fetched ${guardianSetUpgrades.length.toString()} guardian-set upgrade VAA(s)`,
      );
      await applyGuardianSetUpgrades(
        chain,
        signer,
        initialized.stateId,
        guardianSetUpgrades,
      );
    }

    console.info("Recording published Wormhole address in Move.toml...");
    await IotaChain.setPackageAddress(packagePath, published.packageId);

    console.info("Saving Wormhole contract in store...");
    const contract = new IotaWormholeContract(chain, initialized.stateId);
    updateWormholeContractInStore(contract);
    console.info(`Contract ID: ${contract.getId()}`);
  },
);

parser.command(
  "deploy",
  "deploy contract to a selected chain",
  (b) =>
    b.options({
      "governance-address": {
        description: "address of the governance contract on its chain",
        type: "string",
      },
      "governance-chain": {
        default: CHAINS.solana,
        demandOption: true,
        description: "Wormhole chain ID where the governance is located",
        type: "number",
      },
      path: commonOptions.packagePath,
      "private-key": commonOptions["private-key"],
      "upgrade-cap": {
        description: "existing UpgradeCap ID to use instead of publishing",
        type: "string",
      },
      wormhole: commonOptions.wormhole,
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
        governanceAddress = emitterKey.toBuffer().toString("hex");
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
        receiver_chain_id: chain.getWormholeChainId(),
        version: "1",
      };
      await chain.updateLazerMeta(packagePath, meta);

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
        emitterAddress: governanceAddress,
        emitterChain: governanceChain,
      },
      signer,
    );
    console.info("Package state initialized:");
    console.info(`  State: ${chain.explorerUrl("object", stateId)}`);

    console.info("Saving initialized contract in store...");
    const contract = new IotaLazerContract(chain, stateId, wormholeStateId);
    updateContractInStore(contract);
    console.info(`Contract ID: ${contract.getId()}`);
  },
);

parser.command(
  "update-contract-meta",
  "updates `meta` module and links `Move.toml` for the selected chain",
  (b) =>
    b.options({
      contract: commonOptions.contract,
      path: commonOptions.packagePath,
    }),
  async ({ chain, path: packagePath, contract }) => {
    const { version } = await chain.getStatePackageInfo(
      chain.getProvider(),
      contract.stateId,
    );
    await chain.updateLazerMeta(packagePath, {
      receiver_chain_id: chain.getWormholeChainId(),
      version,
    });
  },
);

parser.command(
  "test-upgrade",
  "upgrade specified test contract",
  (b) =>
    b.options({
      contract: commonOptions.contract,
      emitter: commonOptions.emitter,
      path: commonOptions.packagePath,
      "private-key": commonOptions["private-key"],
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
    const meta = await contract.fetchAndBumpMeta(chain, packagePath);

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
      meta,
      pkg,
      signer,
      stateId: contract.stateId,
      vaa,
      wormholeStateId: contract.wormholeStateId,
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
      contract: commonOptions.contract,
      emitter: commonOptions.emitter,
      expires: commonOptions.expires,
      "private-key": commonOptions["private-key"],
      signer: commonOptions["trusted-signer"],
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
    console.info("Using wallet:", emitterWallet.publicKey.toBase58());

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
      signer,
      stateId: contract.stateId,
      vaa,
      wormholeStateId: contract.wormholeStateId,
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
      contract: commonOptions.contract,
      path: commonOptions.packagePath,
      wallet: commonOptions["solana-wallet"],
    }),
  async ({ chain, path: packagePath, contract, wallet: walletPath }) => {
    const wallet = await loadHotWallet(walletPath);
    const vault = connectMainnetVault(wallet);
    console.info("Using wallet:", wallet.publicKey.toBase58());

    console.info("Creating package upgrade proposal...");

    console.info("Updating package metadata...");
    const { version } = await contract.fetchAndBumpMeta(chain, packagePath);

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
    const payload = chain.generateGovernanceUpdateTrustedSignerPayload(
      trustedSigner,
      expires,
    );
    const proposal = await vault.proposeWormholeMessage([payload]);
    console.log("Proposal address:", proposal.address.toBase58());
  },
);

parser.command(
  "execute-proposals",
  "execute unseen compatible proposals",
  (b) =>
    b
      .options({
        contract: commonOptions.contract,
        path: commonOptions.packagePath,
        "private-key": commonOptions["private-key"],
        since: {
          description: "VAA sequence ID to start from (inclusive)",
          type: "number",
        },
      })
      .array("ids"),
  async ({ chain, privateKey, contract, path: packagePath, since }) => {
    const signer = Ed25519Keypair.fromSecretKey(privateKey);
    const vault = getMainnetVault();

    await contract.executeGovernanceProposals(
      signer,
      chain,
      vault,
      packagePath,
      since,
    );
  },
);

await parser.parseAsync(hideBin(process.argv));
