/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { Wallet } from "@coral-xyz/anchor";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { normalizeIotaAddress } from "@iota/iota-sdk/utils";
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

const DEFAULT_WORMHOLE_REPOSITORY =
  "https://github.com/wormhole-foundation/wormhole.git";
const DEFAULT_WORMHOLE_REF = "main";

type CommandResult = {
  stderr: string;
  stdout: string;
};

type CommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<CommandResult>;

const execFileAsync = promisify(execFile);

const runCommand: CommandRunner = async (command, args) => {
  const { stderr, stdout } = await execFileAsync(command, [...args], {
    encoding: "utf8",
  });
  return { stderr, stdout };
};

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code: unknown }).code === "ENOENT"
  );
}

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

async function rewriteMoveSources(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteMoveSources(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".move")) {
      const source = await readFile(entryPath, "utf8");
      const rewritten = source
        .replaceAll(/\bSUI\b/g, "IOTA")
        .replaceAll(/\bSui\b/g, "Iota")
        .replaceAll(/\bsui\b/g, "iota");
      if (source !== rewritten) await writeFile(entryPath, rewritten);
    }
  }
}

async function applyPatch(
  runner: CommandRunner,
  packageDirectory: string,
  patchFile: string,
  dryRun = false,
): Promise<void> {
  await runner("patch", [
    ...(dryRun ? ["--dry-run"] : []),
    "-p1",
    "-d",
    packageDirectory,
    "-N",
    "-s",
    "-V",
    "none",
    "-i",
    patchFile,
  ]);
}

type WormholePublicationPatchOptions = {
  packageDirectory: string;
  patchesDirectory: string;
  runCommand?: CommandRunner;
};

async function applyWormholePublicationPatch({
  dryRun,
  packageDirectory,
  packageId,
  patchesDirectory,
  runCommand: runner = runCommand,
}: WormholePublicationPatchOptions & {
  dryRun: boolean;
  packageId: string;
}): Promise<void> {
  const normalizedPackageId = normalizeIotaAddress(packageId, false, true);
  const workDirectory = await mkdtemp(
    path.join(path.dirname(packageDirectory), ".record-wormhole-"),
  );

  try {
    const publicationPatchTemplate = await readFile(
      path.join(patchesDirectory, "publication.patch.tmpl"),
      "utf8",
    );
    const publicationPatchFile = path.join(workDirectory, "publication.patch");
    await writeFile(
      publicationPatchFile,
      publicationPatchTemplate.replaceAll(
        "__PACKAGE_ID__",
        normalizedPackageId,
      ),
    );
    await applyPatch(runner, packageDirectory, publicationPatchFile, dryRun);
  } finally {
    await rm(workDirectory, { force: true, recursive: true });
  }
}

async function assertWormholePublicationPatchApplies(
  options: WormholePublicationPatchOptions,
): Promise<void> {
  await applyWormholePublicationPatch({
    ...options,
    dryRun: true,
    packageId: "0x0",
  });
}

async function recordWormholePublication(
  options: WormholePublicationPatchOptions & { packageId: string },
): Promise<void> {
  await applyWormholePublicationPatch({
    ...options,
    dryRun: false,
  });
}

async function replaceDirectory(
  stagedDirectory: string,
  targetDirectory: string,
  workDirectory: string,
): Promise<void> {
  const previousDirectory = path.join(workDirectory, "previous");
  let hasPreviousDirectory = false;
  try {
    await rename(targetDirectory, previousDirectory);
    hasPreviousDirectory = true;
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  try {
    await rename(stagedDirectory, targetDirectory);
  } catch (error) {
    if (hasPreviousDirectory) await rename(previousDirectory, targetDirectory);
    throw error;
  }

  if (hasPreviousDirectory) {
    await rm(previousDirectory, { force: true, recursive: true });
  }
}

function getIotaNetworkName(chainId: string): string {
  const network = chainId.replace(/^iota_/, "");
  if (network === chainId || network.length === 0) {
    throw new Error(
      `Cannot derive IOTA network name from chain ID '${chainId}'`,
    );
  }
  return network;
}

async function vendorWormhole({
  chainId,
  onProgress = () => undefined,
  patchesDirectory,
  ref = DEFAULT_WORMHOLE_REF,
  repository = DEFAULT_WORMHOLE_REPOSITORY,
  runCommand: runner = runCommand,
  targetDirectory,
}: {
  chainId: number;
  onProgress?: (message: string) => void;
  patchesDirectory: string;
  ref?: string;
  repository?: string;
  runCommand?: CommandRunner;
  targetDirectory: string;
}): Promise<{ testOutput: string }> {
  if (!Number.isInteger(chainId) || chainId < 0 || chainId > 65_535) {
    throw new Error(
      `Wormhole chain ID must fit in a u16 (0-65535), got ${chainId.toString()}`,
    );
  }

  const targetParent = path.dirname(targetDirectory);
  await mkdir(targetParent, { recursive: true });
  const workDirectory = await mkdtemp(
    path.join(targetParent, ".vendor-wormhole-"),
  );
  const repositoryDirectory = path.join(workDirectory, "repository");
  const stagedDirectory = path.join(workDirectory, "package");
  const existingLock = await readIfExists(
    path.join(targetDirectory, "Move.lock"),
  );

  try {
    onProgress(`Fetching ${repository} @ ${ref}`);
    await runner("git", [
      "clone",
      "--quiet",
      "--filter=blob:none",
      "--no-checkout",
      repository,
      repositoryDirectory,
    ]);
    await runner("git", [
      "-C",
      repositoryDirectory,
      "sparse-checkout",
      "init",
      "--cone",
    ]);
    await runner("git", [
      "-C",
      repositoryDirectory,
      "sparse-checkout",
      "set",
      "sui/wormhole",
    ]);
    await runner("git", [
      "-C",
      repositoryDirectory,
      "checkout",
      "--quiet",
      ref,
    ]);

    const sourceDirectory = path.join(repositoryDirectory, "sui", "wormhole");
    await cp(sourceDirectory, stagedDirectory, { recursive: true });
    await Promise.all([
      rm(path.join(stagedDirectory, ".git"), {
        force: true,
        recursive: true,
      }),
      rm(path.join(stagedDirectory, "build"), {
        force: true,
        recursive: true,
      }),
      rm(path.join(stagedDirectory, "Move.lock"), { force: true }),
      rm(path.join(stagedDirectory, "Published.toml"), { force: true }),
    ]);
    if (existingLock) {
      await writeFile(path.join(stagedDirectory, "Move.lock"), existingLock);
    }

    onProgress("Rewriting Sui sources for IOTA");
    await rewriteMoveSources(stagedDirectory);

    const staticPatches = (await readdir(patchesDirectory))
      .filter((file) => /^\d.*\.patch$/.test(file))
      .sort();
    if (staticPatches.length === 0) {
      throw new Error(`No static patches found in ${patchesDirectory}`);
    }
    for (const patchFile of staticPatches) {
      onProgress(`Applying ${patchFile}`);
      await applyPatch(
        runner,
        stagedDirectory,
        path.join(patchesDirectory, patchFile),
      );
    }

    onProgress(`Applying Wormhole chain ID ${chainId.toString()}`);
    const chainPatchTemplate = await readFile(
      path.join(patchesDirectory, "chain-id.patch.tmpl"),
      "utf8",
    );
    const chainPatchFile = path.join(workDirectory, "chain-id.patch");
    await writeFile(
      chainPatchFile,
      chainPatchTemplate.replaceAll("__CHAIN_ID__", chainId.toString()),
    );
    await applyPatch(runner, stagedDirectory, chainPatchFile);

    onProgress("Running vendored Wormhole tests");
    const { stdout } = await runner("iota", [
      "move",
      "test",
      "-p",
      stagedDirectory,
    ]);

    await replaceDirectory(stagedDirectory, targetDirectory, workDirectory);
    return { testOutput: stdout.trim() };
  } finally {
    await rm(workDirectory, { force: true, recursive: true });
  }
}

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
const wormholePatchesDirectory = path.resolve(
  scriptDir,
  "../../lazer/contracts/iota/patches",
);
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
  const network = getIotaNetworkName(chain.getId());
  return path.resolve(
    scriptDir,
    `../../lazer/contracts/iota/vendor/wormhole_${network}`,
  );
}

async function findWormholeContractForPackage(
  chain: IotaChain,
  packageId: string,
): Promise<IotaWormholeContract> {
  const dependencyIds = await chain.getPackageDependencyOriginalIds(packageId);
  const candidates = Object.values(DefaultStore.wormhole_contracts).filter(
    (contract): contract is IotaWormholeContract =>
      contract instanceof IotaWormholeContract &&
      contract.chain.getId() === chain.getId(),
  );
  const matches = (
    await Promise.all(
      candidates.map(async (contract) => ({
        contract,
        packageId: (
          await chain.getStatePackageInfo(chain.getProvider(), contract.stateId)
        ).package,
      })),
    )
  ).filter(({ packageId: dependency }) =>
    dependencyIds.has(normalizeIotaAddress(dependency)),
  );
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(
      `Expected exactly one stored Wormhole contract linked by Lazer package ${packageId}, found ${matches.length.toString()}`,
    );
  }
  return matches[0].contract;
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
      description: "IOTA chain ID from IotaChains.json",
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
  "vendor-wormhole",
  "vendor and test the upstream Wormhole contract for the selected IOTA chain",
  (b) =>
    b.options({
      ref: {
        default: DEFAULT_WORMHOLE_REF,
        description: "Git ref of the Wormhole repository to vendor",
        type: "string",
      },
      repo: {
        default: DEFAULT_WORMHOLE_REPOSITORY,
        description: "Git URL or local path of the Wormhole repository",
        type: "string",
      },
    }),
  async ({ chain, ref, repo }) => {
    const targetDirectory = getWormholeVendorPath(chain);
    console.info(
      `Vendoring Wormhole for '${chain.getId()}' into '${targetDirectory}'`,
    );
    const { testOutput } = await vendorWormhole({
      chainId: chain.getWormholeChainId(),
      onProgress: (message) => console.info(`==> ${message}`),
      patchesDirectory: wormholePatchesDirectory,
      ref,
      repository: repo,
      targetDirectory,
    });
    if (testOutput.length > 0) console.info(testOutput);
    console.info(`Vendored Wormhole is ready: ${targetDirectory}`);
  },
);

parser.command(
  "deploy-wormhole",
  "build, publish, initialize and save the vendored Wormhole contract",
  (b) =>
    b.options({
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
    guardianSetTtl,
    initialGuardian,
    privateKey,
    upgradeGuardianSet,
  }) => {
    const { wormholeConfig: defaults } = getDefaultDeploymentConfig("stable");
    const initialGuardians = initialGuardian ?? defaults.initialGuardianSet;
    const config = {
      governanceChain: defaults.governanceChainId,
      governanceEmitter: IotaChain.bytesFromHex(
        defaults.governanceContract,
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

    console.info("Checking Wormhole publication patch...");
    await assertWormholePublicationPatchApplies({
      packageDirectory: packagePath,
      patchesDirectory: wormholePatchesDirectory,
    });

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

    console.info("Recording published Wormhole address in Move.toml...");
    await recordWormholePublication({
      packageDirectory: packagePath,
      packageId: published.packageId,
      patchesDirectory: wormholePatchesDirectory,
    });

    console.info("Recording published Wormhole address in Move.lock...");
    await chain.recordPackagePublication(packagePath, {
      latestId: published.packageId,
      originalId: published.packageId,
      version: "1",
    });

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

    console.info("Saving Wormhole contract in store...");
    const contract = new IotaWormholeContract(chain, initialized.stateId);
    updateWormholeContractInStore(contract);
    console.info(`Contract ID: ${contract.getId()}`);

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
  },
);

parser.command(
  "deploy",
  "deploy contract to a selected chain",
  (b) =>
    b
      .options({
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
          description: "existing UpgradeCap ID to resume initialization",
          type: "string",
        },
        wormhole: { ...commonOptions.wormhole, demandOption: false },
      })
      .check(({ upgradeCap, wormhole }) => {
        if ((upgradeCap === undefined) === (wormhole === undefined)) {
          throw new Error("Specify exactly one of --wormhole or --upgrade-cap");
        }
        return true;
      }),
  async ({
    chain,
    privateKey,
    path: packagePath,
    wormhole: requestedWormholeStateId,
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

    const signer = Ed25519Keypair.fromSecretKey(privateKey);
    console.info(`Deploying '${packagePath}' to '${chain.getId()}':`);

    let packageId: string;
    let upgradeCapId: string;
    let wormholeStateId: string;
    if (existingUpgradeCapId) {
      console.info("Got UpgradeCap ID, finding existing package...");
      const packageInfo = await chain.getUpgradeCapInfo(existingUpgradeCapId);
      packageId = packageInfo.package;
      upgradeCapId = existingUpgradeCapId;
      const wormholeContract = await findWormholeContractForPackage(
        chain,
        packageId,
      );
      wormholeStateId = wormholeContract.stateId;
      await chain.updateLazerMeta(
        packagePath,
        {
          receiver_chain_id: chain.getWormholeChainId(),
          version: packageInfo.version,
        },
        packageId,
      );
      console.info("Found package:");
    } else {
      if (!requestedWormholeStateId) {
        throw new Error("Missing Wormhole state ID");
      }
      wormholeStateId = requestedWormholeStateId;
      console.info(`Checking Wormhole state ${wormholeStateId}...`);
      const { package: wormholePackageId } = await chain.getStatePackageInfo(
        chain.getProvider(),
        wormholeStateId,
      );
      console.info(`Found Wormhole package: ${wormholePackageId}`);

      console.info("Initializing package metadata...");
      const meta = {
        receiver_chain_id: chain.getWormholeChainId(),
        version: "1",
      };
      await chain.updateLazerMeta(packagePath, meta, "0x0");

      console.info("Building package...");
      const pkg = await chain.buildLazerPackage(packagePath, wormholeStateId);
      const digest = Buffer.from(pkg.digest).toString("hex");
      console.info(`Package digest: ${digest}`);

      console.info("Publishing package...");
      ({ packageId, upgradeCapId } = await chain.publishLazerPackage(
        pkg,
        meta,
        signer,
      ));
      await chain.updateLazerMeta(packagePath, meta, packageId);
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
    const { package: packageId, version } = await chain.getStatePackageInfo(
      chain.getProvider(),
      contract.stateId,
    );
    await chain.updateLazerMeta(
      packagePath,
      {
        receiver_chain_id: chain.getWormholeChainId(),
        version,
      },
      packageId,
    );
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
    const pkg = await chain.buildLazerPackage(
      packagePath,
      contract.wormholeStateId,
    );
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
    const pkg = await chain.buildLazerPackage(
      packagePath,
      contract.wormholeStateId,
    );
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
