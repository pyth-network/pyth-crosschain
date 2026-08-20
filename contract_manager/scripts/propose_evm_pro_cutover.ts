/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Creates the governance proposal that cuts legacy EVM price feed proxies over to Pyth Pro.
 *
 * Per chain it proposes three actions, and the order is the point:
 *
 *  1. `UpgradeContract` to the implementation the deploy phase left in the cache
 *  2. `SetDataSources` to the Pro price emitter
 *  3. `SetWormholeAddress` to the Pro receiver
 *
 * The array order becomes the VAA sequence order, and a proxy only accepts governance in
 * increasing sequence, so this is also the only order in which they can execute. Between 2 and 3
 * the proxy verifies nothing, which is why those two are executed in a single transaction later.
 *
 * The chain list is derived, not supplied: every selected chain is preflighted and its deployed
 * artifacts are read back on chain, and anything incomplete is skipped with a reason. A chain
 * cannot end up in the proposal with a stale or missing address just because an earlier deploy
 * run printed it.
 *
 * Usage: $0 --chain ethereum --ops-key-path <path> [--dry-run]
 */

import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  decodeGovernancePayload,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  MAX_INSTRUCTIONS_PER_PROPOSAL,
  SetDataSources,
} from "@pythnetwork/xc-admin-common";
import { PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { getDefaultDeploymentConfig, toDeploymentType } from "../src/core/base";
import type { EvmChain } from "../src/core/chains";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { CHAIN_SELECTION_OPTIONS, getSelectedChains } from "./common";
import type { CutoverPreflight, ProDeploymentType } from "./pro_cutover";
import {
  CUTOVER_CACHE_FILE,
  isProDeploymentType,
  preflightChains,
  readCachedImplementation,
  sameDataSourceSet,
  statusOf,
  VAULT_BY_DEPLOYMENT_TYPE,
  verifyImplementation,
} from "./pro_cutover";

const parser = yargs(hideBin(process.argv))
  .scriptName("propose_evm_pro_cutover.ts")
  .usage(
    "Proposes the three-action Pyth Pro cutover for a set of EVM chains.\n" +
      "Run the deploy phase first; this reads the addresses it left behind and verifies them on chain.\n" +
      "Usage: $0 (--all-chains [--testnet] | --chain <chain>...) --ops-key-path <path>",
  )
  .options({
    ...CHAIN_SELECTION_OPTIONS,
    "cache-file": {
      default: CUTOVER_CACHE_FILE,
      desc: "Cache file the deploy phase wrote the implementation addresses to",
      type: "string",
    },
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "The pro-compatible deployment being cut over to",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Build and verify the payloads, print them, and exit without proposing. Does not need a key",
      type: "boolean",
    },
    "ops-key-path": {
      demandOption: false,
      desc: "Path to the proposer's private key. Required unless --dry-run",
      type: "string",
    },
    "proposal-address": {
      demandOption: false,
      desc: "Resume adding instructions to an existing proposal, for when a previous run died partway. Only safe if the selected chains produce the same payloads in the same order",
      type: "string",
    },
    vault: {
      demandOption: false,
      desc: "Override the vault id. Defaults to the vault that owns the deployment type's governance emitter",
      type: "string",
    },
  });

/** One governance action, with the one-liner shown in the plan. */
type CutoverAction = {
  description: string;
  payload: Buffer;
};

/** Everything needed to propose the cutover for a single chain. */
type ChainProposal = {
  chain: EvmChain;
  implementationAddress: string;
  implementationVersion: string;
  wormholeAddress: string;
  actions: CutoverAction[];
};

function strip(address: string): string {
  return address.replace("0x", "").toLowerCase();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeDataSources(dataSources: DataSource[]): string {
  return dataSources
    .map((source) => `${source.emitterChain}:${source.emitterAddress}`)
    .join(", ");
}

/**
 * Builds the three cutover actions for a chain, in execution order.
 * @param {EvmChain} chain The chain to build for.
 * @param {string} implementationAddress The implementation `UpgradeContract` will point at.
 * @param {string} wormholeAddress The Pro receiver `SetWormholeAddress` will point at.
 * @param {DataSource[]} dataSources The Pro price emitters.
 * @returns The three actions, in the only order they can execute in.
 */
function buildActions(
  chain: EvmChain,
  implementationAddress: string,
  wormholeAddress: string,
  dataSources: DataSource[],
): CutoverAction[] {
  return [
    {
      description: `UpgradeContract      implementation ${implementationAddress}`,
      payload: chain.generateGovernanceUpgradePayload(
        strip(implementationAddress),
      ),
    },
    {
      description: `SetDataSources       ${describeDataSources(dataSources)}`,
      payload: chain.generateGovernanceSetDataSources(dataSources),
    },
    {
      description: `SetWormholeAddress   receiver ${wormholeAddress}`,
      payload: chain.generateGovernanceSetWormholeAddressPayload(
        strip(wormholeAddress),
      ),
    },
  ];
}

/**
 * Decodes the payloads back and checks they say what we meant them to say.
 *
 * Cheap, and the last chance to catch a payload construction bug: once signers approve, the bytes
 * are what execute.
 * @param {EvmChain} chain The chain the actions target.
 * @param {CutoverAction[]} actions The actions to check.
 * @param {string} implementationAddress The expected implementation address.
 * @param {string} wormholeAddress The expected Pro receiver address.
 * @param {DataSource[]} dataSources The expected Pro price emitters.
 * @throws {Error} if any payload does not decode to what was intended.
 */
function verifyActions(
  chain: EvmChain,
  actions: CutoverAction[],
  implementationAddress: string,
  wormholeAddress: string,
  dataSources: DataSource[],
): void {
  const decoded = actions.map((action) =>
    decodeGovernancePayload(action.payload),
  );
  const [upgrade, setDataSources, setWormhole] = decoded;

  for (const [index, action] of decoded.entries()) {
    if (action === undefined) {
      throw new Error(`Payload ${index + 1} does not decode.`);
    }
    if (action.targetChainId !== chain.wormholeChainName) {
      throw new Error(
        `Payload ${index + 1} targets ${action.targetChainId}, expected ${chain.wormholeChainName}.`,
      );
    }
  }

  if (
    !(upgrade instanceof EvmUpgradeContract) ||
    strip(upgrade.address) !== strip(implementationAddress)
  ) {
    throw new Error(
      `UpgradeContract payload does not name implementation ${implementationAddress}.`,
    );
  }
  if (
    !(setDataSources instanceof SetDataSources) ||
    !sameDataSourceSet(setDataSources.dataSources, dataSources)
  ) {
    throw new Error(
      `SetDataSources payload does not name the ${describeDataSources(dataSources)} data sources.`,
    );
  }
  if (
    !(setWormhole instanceof EvmSetWormholeAddress) ||
    strip(setWormhole.address) !== strip(wormholeAddress)
  ) {
    throw new Error(
      `SetWormholeAddress payload does not name receiver ${wormholeAddress}.`,
    );
  }
}

/**
 * Turns a preflight result into a chain proposal, or explains why the chain cannot be proposed.
 *
 * Skipping is the normal outcome for a chain the deploy phase has not reached yet, so a skip is
 * reported rather than thrown.
 * @param {CutoverPreflight} result The chain's preflight result.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @param {string} cacheFile The cache file the deploy phase wrote to.
 * @returns The proposal for this chain, or the reason it was skipped.
 */
async function planChain(
  result: CutoverPreflight,
  deploymentType: ProDeploymentType,
  cacheFile: string,
): Promise<ChainProposal | { skipped: string }> {
  const { chain } = result;
  const status = statusOf(result);
  if (status === "BLOCKED") {
    return { skipped: `blocked: ${result.blockers.join(" ")}` };
  }
  if (status === "MIGRATED") {
    return { skipped: "already cut over to the Pro receiver" };
  }
  if (result.proWormhole === undefined) {
    return {
      skipped: `no ${deploymentType} wormhole receiver in the store; run the deploy phase first`,
    };
  }

  const implementationAddress = readCachedImplementation(
    cacheFile,
    chain,
    deploymentType,
  );
  if (implementationAddress === undefined) {
    return {
      skipped: `no implementation in ${cacheFile}; run the deploy phase first`,
    };
  }

  let implementationVersion: string;
  try {
    implementationVersion = await verifyImplementation(
      chain,
      implementationAddress,
    );
  } catch (error) {
    return { skipped: describeError(error) };
  }

  const { dataSources } = getDefaultDeploymentConfig(deploymentType);
  const wormholeAddress = result.proWormhole.address;
  const actions = buildActions(
    chain,
    implementationAddress,
    wormholeAddress,
    dataSources,
  );
  verifyActions(
    chain,
    actions,
    implementationAddress,
    wormholeAddress,
    dataSources,
  );

  return {
    actions,
    chain,
    implementationAddress,
    implementationVersion,
    wormholeAddress,
  };
}

/**
 * Confirms the vault's emitter is the governance data source the target proxies trust.
 *
 * Proposing from the wrong vault produces VAAs every target rejects, which is only discovered
 * after signers have approved them.
 * @param {string} vaultId The vault id being used.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @throws {Error} if the vault is unknown or its emitter is not the expected governance source.
 */
async function verifyVaultEmitter(
  vaultId: string,
  deploymentType: ProDeploymentType,
): Promise<void> {
  const vault = DefaultStore.vaults[vaultId];
  if (vault === undefined) throw new Error(`Unknown vault ${vaultId}`);

  const { governanceDataSource } = getDefaultDeploymentConfig(deploymentType);
  const emitter = await vault.getEmitter();
  const actual = emitter.toBuffer().toString("hex");
  if (actual !== strip(governanceDataSource.emitterAddress)) {
    throw new Error(
      `Vault ${vaultId} emits from ${actual}, but ${deploymentType} contracts accept governance from ` +
        `${governanceDataSource.emitterAddress}. Proposing from this vault would produce VAAs every target rejects.`,
    );
  }
  console.log(`Vault ${vaultId} emitter ${actual} matches ${deploymentType}.`);
}

async function main() {
  const argv = await parser.argv;

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }
  if (!argv.dryRun && argv.opsKeyPath === undefined) {
    throw new Error("--ops-key-path is required unless --dry-run is set");
  }

  const vaultId = argv.vault ?? VAULT_BY_DEPLOYMENT_TYPE[deploymentType];
  await verifyVaultEmitter(vaultId, deploymentType);

  const selectedChains = getSelectedChains(argv);
  console.log(
    `\nPreflighting ${selectedChains.length} chain(s) against ${deploymentType}...`,
  );
  const results = await preflightChains(selectedChains, deploymentType);

  const proposals: ChainProposal[] = [];
  const skipped: { chain: string; reason: string }[] = [];
  for (const result of results) {
    const planned = await planChain(result, deploymentType, argv.cacheFile);
    if ("skipped" in planned) {
      skipped.push({ chain: result.chain.getId(), reason: planned.skipped });
    } else {
      proposals.push(planned);
    }
  }

  for (const proposal of proposals) {
    console.log(
      `\n${proposal.chain.getId()} (implementation v${proposal.implementationVersion})`,
    );
    for (const action of proposal.actions) {
      console.log(`  ${action.description}`);
    }
    for (const warning of results.find(
      (result) => result.chain.getId() === proposal.chain.getId(),
    )?.warnings ?? []) {
      console.log(`  ! ${warning}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} chain(s)`);
    for (const entry of skipped) {
      console.log(`  ${entry.chain}: ${entry.reason}`);
    }
  }

  const payloads = proposals.flatMap((proposal) =>
    proposal.actions.map((action) => action.payload),
  );
  console.log(
    `\n${proposals.length} chain(s) to propose, ${payloads.length} governance action(s).`,
  );
  if (payloads.length === 0) return;
  if (payloads.length > MAX_INSTRUCTIONS_PER_PROPOSAL) {
    throw new Error(
      `${payloads.length} actions exceeds the ${MAX_INSTRUCTIONS_PER_PROPOSAL} per proposal limit. ` +
        `Split the chain list across several runs.`,
    );
  }

  if (argv.dryRun) {
    console.log("\n--dry-run set, nothing proposed.");
    return;
  }
  if (argv.opsKeyPath === undefined) {
    throw new Error("unreachable: no ops key path");
  }

  const vault = DefaultStore.vaults[vaultId];
  if (vault === undefined) throw new Error(`Unknown vault ${vaultId}`);
  const wallet = await loadHotWallet(argv.opsKeyPath);
  console.log(`\nProposing from ${wallet.publicKey.toBase58()}...`);
  await vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(
    payloads,
    argv.proposalAddress === undefined
      ? undefined
      : new PublicKey(argv.proposalAddress),
  );
  console.log(`Proposal address ${proposal.address.toBase58()}`);
  console.log(
    "Review it with check_proposal.ts before approving, then execute per chain.",
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
