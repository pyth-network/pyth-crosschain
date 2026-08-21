/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Executes an approved Pyth Pro cutover on EVM chains, then verifies the result.
 *
 * Takes the three VAAs the proposal produced and applies them to each legacy proxy:
 *
 *  1. `UpgradeContract` on its own
 *  2. `SetDataSources` and `SetWormholeAddress` **in a single transaction** through Multicall3
 *
 * Step 2 matters. Between those two actions the proxy holds Pro data sources while still verifying
 * against its old wormhole, so it can verify no price update at all until the second lands. One
 * transaction means that window never exists on chain.
 *
 * Where Multicall3 is not deployed the two actions are sent separately and the window is accepted,
 * with a warning naming it. `--force-sequential` does the same everywhere, for a batch that would
 * rather behave uniformly. If the second transaction fails, the proxy stays exposed until a re-run;
 * this script detects that state and repairs it by sending the third VAA on its own.
 *
 * Execution is address-scoped: it targets each proxy directly and never uses `executeVaa`, which
 * submits to every contract on the chain with a matching governance emitter. Most chains host a
 * Pro proxy alongside the legacy one, and a cutover VAA sent to the Pro proxy reverts.
 *
 * Usage: $0 --chain ethereum --from-sequence 900 --to-sequence 902 --private-key <key> [--dry-run]
 */

import { parseVaa } from "@certusone/wormhole-sdk";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import type { PythGovernanceAction } from "@pythnetwork/xc-admin-common";
import {
  decodeGovernancePayload,
  EvmSetWormholeAddress,
} from "@pythnetwork/xc-admin-common";
import type { PublicKey } from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import {
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import type { EvmPriceFeedContract } from "../src/core/contracts";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import {
  CHAIN_SELECTION_OPTIONS,
  findWormholeContract,
  getSelectedChains,
} from "./common";
import type { ProDeploymentType } from "./pro_cutover";
import {
  findLegacyPriceFeedContracts,
  isProDeploymentType,
  MULTICALL3_ADDRESS,
  sameDataSourceSet,
  selectGovernedContracts,
  VAULT_BY_DEPLOYMENT_TYPE,
} from "./pro_cutover";
import { actionNameOf, reviewProposedActions } from "./proposal_review";

/**
 * ABIs as untyped literals, the same way `src/core/contracts/evm_abis.ts` does it. web3 v1 accepts
 * them as-is and hand-typing them against its `AbiItem` union buys nothing here.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped ABI, as in src/core/contracts/evm_abis.ts
const MULTICALL3_ABI: any = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bool", name: "allowFailure", type: "bool" },
          { internalType: "bytes", name: "callData", type: "bytes" },
        ],
        internalType: "struct Multicall3.Call3[]",
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" },
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
];

// biome-ignore lint/suspicious/noExplicitAny: untyped ABI, as in src/core/contracts/evm_abis.ts
const EXECUTE_GOVERNANCE_INSTRUCTION_ABI: any = {
  inputs: [{ internalType: "bytes", name: "encodedVM", type: "bytes" }],
  name: "executeGovernanceInstruction",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
};

const parser = yargs(hideBin(process.argv))
  .scriptName("execute_evm_pro_cutover.ts")
  .usage(
    "Executes an approved Pro cutover on EVM chains and verifies the result.\n" +
      "SetDataSources and SetWormholeAddress are sent in one Multicall3 transaction where it\n" +
      "exists, so the proxy is never left unable to verify. Elsewhere they are sent separately\n" +
      "and that window is accepted.\n" +
      "Usage: $0 (--all-chains [--testnet] | --chain <chain>...) --from-sequence <n> --to-sequence <n> --private-key <key>",
  )
  .options({
    ...CHAIN_SELECTION_OPTIONS,
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "The pro-compatible deployment being cut over to",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Fetch and check the VAAs, read every proxy, print what would be sent, and stop. Does not need a key",
      type: "boolean",
    },
    "force-sequential": {
      default: false,
      desc: "Send SetDataSources and SetWormholeAddress as two transactions even where Multicall3 exists, for uniform behaviour across a batch",
      type: "boolean",
    },
    "from-sequence": {
      demandOption: true,
      desc: "Wormhole sequence number of the proposal's first governance message",
      type: "number",
    },
    "private-key": {
      demandOption: false,
      desc: "Private key to send the transactions with. Required unless --dry-run",
      type: "string",
    },
    "save-contract": {
      default: true,
      desc: "Flip the store entry's deploymentType once a proxy is verified as cut over",
      type: "boolean",
    },
    "to-sequence": {
      demandOption: true,
      desc: "Wormhole sequence number of the proposal's last governance message",
      type: "number",
    },
  });

/** One governance VAA, with the sequence number the proxy checks against its watermark. */
type FetchedVaa = {
  action: PythGovernanceAction;
  sequence: number;
  vaa: Buffer;
};

/** The three VAAs that cut one chain over, in execution order. */
type CutoverTriple = {
  upgrade: FetchedVaa;
  setDataSources: FetchedVaa;
  setWormholeAddress: FetchedVaa;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeAddress(address: string): string {
  return address.replace("0x", "").toLowerCase();
}

/**
 * Fetches the proposal's governance VAAs from the wormhole API.
 * @param {PublicKey} emitter The vault's wormhole emitter.
 * @param {PythCluster} cluster The emitter's cluster.
 * @param {number} from The first sequence number.
 * @param {number} to The last sequence number.
 * @returns Every VAA in the range, in sequence order.
 * @throws {Error} if a VAA cannot be fetched or does not decode to a governance action.
 */
async function fetchVaas(
  emitter: PublicKey,
  cluster: PythCluster,
  from: number,
  to: number,
): Promise<FetchedVaa[]> {
  const fetched: FetchedVaa[] = [];
  for (let sequence = from; sequence <= to; sequence++) {
    const message = new SubmittedWormholeMessage(emitter, sequence, cluster);
    let vaa: Buffer;
    try {
      vaa = await message.fetchVaa(30);
    } catch (error) {
      throw new Error(
        `Could not fetch VAA ${sequence} from emitter ${emitter.toBase58()}: ${describeError(error)}`,
      );
    }
    const action = decodeGovernancePayload(parseVaa(vaa).payload);
    if (action === undefined) {
      throw new Error(
        `VAA ${sequence} does not decode to a governance action. Check the sequence range.`,
      );
    }
    fetched.push({ action, sequence, vaa });
  }
  return fetched;
}

/**
 * Groups the fetched VAAs into one cutover triple per target chain.
 *
 * A chain whose VAAs are not exactly the three cutover actions is left out, so a proposal that
 * mixes cutovers with other governance work still executes the cutovers it does contain.
 * @param {FetchedVaa[]} vaas The fetched VAAs, in sequence order.
 * @returns The complete triples, keyed by wormhole chain name.
 */
function groupTriples(vaas: FetchedVaa[]): Map<string, CutoverTriple> {
  const byChain = new Map<string, FetchedVaa[]>();
  for (const entry of vaas) {
    const existing = byChain.get(entry.action.targetChainId) ?? [];
    existing.push(entry);
    byChain.set(entry.action.targetChainId, existing);
  }

  const triples = new Map<string, CutoverTriple>();
  for (const [chainName, entries] of byChain) {
    const find = (name: string): FetchedVaa | undefined =>
      entries.find((entry) => actionNameOf(entry.action) === name);
    const upgrade = find("UpgradeContract");
    const setDataSources = find("SetDataSources");
    const setWormholeAddress = find("SetWormholeAddress");
    if (
      upgrade === undefined ||
      setDataSources === undefined ||
      setWormholeAddress === undefined
    ) {
      console.log(
        `  ${chainName}: not a complete cutover (${entries.map((entry) => actionNameOf(entry.action)).join(", ")}), skipping`,
      );
      continue;
    }
    triples.set(chainName, { setDataSources, setWormholeAddress, upgrade });
  }
  return triples;
}

/** What still has to be applied to one proxy, given how far its watermark has advanced. */
type PendingWork = {
  needsUpgrade: boolean;
  needsDataSources: boolean;
  needsWormhole: boolean;
};

/**
 * Works out which of the three actions a proxy has not executed yet.
 *
 * A proxy only accepts governance in increasing sequence, so its watermark says exactly how far it
 * got. This also recognises a proxy stranded between VAA2 and VAA3, whose only safe next move is
 * VAA3 on its own.
 * @param {number} watermark The proxy's `lastExecutedGovernanceSequence`.
 * @param {CutoverTriple} triple The chain's three VAAs.
 * @returns Which actions are still pending.
 */
function pendingWork(watermark: number, triple: CutoverTriple): PendingWork {
  return {
    needsDataSources: watermark < triple.setDataSources.sequence,
    needsUpgrade: watermark < triple.upgrade.sequence,
    needsWormhole: watermark < triple.setWormholeAddress.sequence,
  };
}

/**
 * Checks whether a chain has Multicall3 deployed.
 * @param {EvmPriceFeedContract} contract A contract on the chain to check.
 * @returns True if there is code at the Multicall3 address.
 */
async function hasMulticall3(contract: EvmPriceFeedContract): Promise<boolean> {
  const code = await contract
    .getChain()
    .getWeb3()
    .eth.getCode(MULTICALL3_ADDRESS);
  return code !== "0x" && code !== "0x0";
}

/**
 * Sends `SetDataSources` and `SetWormholeAddress` as one Multicall3 transaction.
 *
 * `allowFailure` is false on both calls, so the transaction reverts as a whole rather than leaving
 * the proxy between the two actions. This is the only way the in-between state never exists.
 * @param {EvmPriceFeedContract} contract The proxy to execute against.
 * @param {PrivateKey} privateKey The key to send from.
 * @param {Buffer[]} vaas The VAAs to execute, in order.
 * @returns The transaction hash.
 * @throws {Error} if the transaction reverts.
 */
async function executeTogether(
  contract: EvmPriceFeedContract,
  privateKey: PrivateKey,
  vaas: Buffer[],
): Promise<string> {
  const chain = contract.getChain();
  const web3 = chain.getWeb3();
  const { address } = web3.eth.accounts.wallet.add(privateKey);
  const calls = vaas.map((vaa) => ({
    allowFailure: false,
    callData: web3.eth.abi.encodeFunctionCall(
      EXECUTE_GOVERNANCE_INSTRUCTION_ABI,
      [`0x${vaa.toString("hex")}`],
    ),
    target: contract.address,
  }));

  const multicall = new web3.eth.Contract(MULTICALL3_ABI, MULTICALL3_ADDRESS);
  // estimateGas runs both calls, so a VAA that would revert fails here rather than on chain.
  const result = await chain.estiamteAndSendTransaction(
    multicall.methods.aggregate3(calls),
    { from: address },
  );
  return String(result.transactionHash);
}

/**
 * Sends `SetDataSources` and `SetWormholeAddress` as two separate transactions.
 *
 * Between them the proxy holds Pro data sources while still verifying against its old wormhole, so
 * it can verify **no** price update at all: Pro updates are signed by a guardian set the old
 * wormhole does not know, and pythnet updates come from emitters that are no longer valid data
 * sources. Reads of already-stored prices keep working, but anything with a staleness check
 * reverts until the second transaction lands.
 *
 * If the second transaction fails the proxy stays in that state until someone re-runs, which this
 * script detects and repairs.
 * @param {EvmPriceFeedContract} contract The proxy to execute against.
 * @param {PrivateKey} privateKey The key to send from.
 * @param {Buffer[]} vaas The VAAs to execute, in order.
 * @returns The transaction hashes, in order.
 * @throws {Error} if either transaction fails, naming the exposed state if the first succeeded.
 */
async function executeSeparately(
  contract: EvmPriceFeedContract,
  privateKey: PrivateKey,
  vaas: Buffer[],
): Promise<string[]> {
  const hashes: string[] = [];
  for (const [index, vaa] of vaas.entries()) {
    try {
      const { id } = await contract.executeGovernanceInstruction(
        privateKey,
        vaa,
      );
      hashes.push(String(id));
    } catch (error) {
      if (index > 0) {
        throw new Error(
          `SetDataSources landed but SetWormholeAddress failed, so ${contract.address} can currently ` +
            `verify no price update. Re-run to send SetWormholeAddress and close the window. ` +
            `Cause: ${describeError(error)}`,
        );
      }
      throw error;
    }
  }
  return hashes;
}

/**
 * Confirms a proxy ended up where the cutover intended.
 * @param {EvmPriceFeedContract} contract The proxy to check.
 * @param {ProDeploymentType} deploymentType The Pro deployment it was cut over to.
 * @param {string} proWormholeAddress The Pro receiver it should now verify against.
 * @param {number} expectedWatermark The sequence of the last VAA applied.
 * @returns Anything worth reporting that is not a failure.
 * @throws {Error} if the proxy is not fully cut over.
 */
async function verifyCutover(
  contract: EvmPriceFeedContract,
  deploymentType: ProDeploymentType,
  proWormholeAddress: string,
  expectedWatermark: number,
): Promise<string[]> {
  const expected = getDefaultDeploymentConfig(deploymentType);
  const warnings: string[] = [];

  const wormhole = await contract.getWormholeContract();
  if (
    normalizeAddress(wormhole.address) !== normalizeAddress(proWormholeAddress)
  ) {
    throw new Error(
      `verifies against ${wormhole.address}, expected the Pro receiver ${proWormholeAddress}`,
    );
  }

  const dataSources = await contract.getDataSources();
  if (!sameDataSourceSet(dataSources, expected.dataSources)) {
    throw new Error(
      `data sources are ${dataSources.map((source) => `${source.emitterChain}:${source.emitterAddress}`).join(", ")}, ` +
        `expected the ${deploymentType} set`,
    );
  }

  // The cutover keeps the governance emitter. If this moved, something other than the cutover ran.
  const governance = await contract.getGovernanceDataSource();
  if (
    governance.emitterChain !== expected.governanceDataSource.emitterChain ||
    normalizeAddress(governance.emitterAddress) !==
      normalizeAddress(expected.governanceDataSource.emitterAddress)
  ) {
    throw new Error(
      `governance data source is now ${governance.emitterChain}:${governance.emitterAddress}, ` +
        `expected it to be unchanged at ${expected.governanceDataSource.emitterChain}:${expected.governanceDataSource.emitterAddress}`,
    );
  }

  const watermark = await contract.getLastExecutedGovernanceSequence();
  if (watermark !== expectedWatermark) {
    warnings.push(
      `governance watermark is ${watermark}, expected ${expectedWatermark}. Something else executed ` +
        `governance on this proxy around the same time.`,
    );
  }

  const fee = await contract.getBaseUpdateFee();
  if (String(fee.amount) !== "0") {
    warnings.push(
      `single update fee is ${String(fee.amount)} wei. Set it to 0 with a separate SetFee proposal.`,
    );
  }

  return warnings;
}

/**
 * The receiver address the `SetWormholeAddress` VAA names.
 *
 * Taken from the VAA rather than from the store, because the VAA is what actually executes. The
 * caller cross-checks it against the store separately.
 * @param {CutoverTriple} triple The chain's three VAAs.
 * @returns The receiver address, lower case and without the `0x` prefix.
 * @throws {Error} if the VAA is not a `SetWormholeAddress` after all.
 */
function expectedReceiver(triple: CutoverTriple): string {
  const action = triple.setWormholeAddress.action;
  if (!(action instanceof EvmSetWormholeAddress)) {
    throw new Error("SetWormholeAddress VAA does not decode as one.");
  }
  return normalizeAddress(action.address);
}

/**
 * Cuts one proxy over and verifies it.
 * @param {EvmPriceFeedContract} contract The proxy to cut over.
 * @param {CutoverTriple} triple The chain's three VAAs.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @param {PrivateKey | undefined} privateKey The key to send with, or undefined for a dry run.
 * @param {boolean} saveContract Whether to flip the store entry once verified.
 * @param {boolean} forceSequential Send the last two actions separately even where Multicall3 exists.
 * @throws {Error} if any step fails, so the caller can record it and move on to the next proxy.
 */
async function cutoverProxy(
  contract: EvmPriceFeedContract,
  triple: CutoverTriple,
  deploymentType: ProDeploymentType,
  privateKey: PrivateKey | undefined,
  saveContract: boolean,
  forceSequential: boolean,
): Promise<void> {
  const watermark = await contract.getLastExecutedGovernanceSequence();
  const pending = pendingWork(watermark, triple);
  console.log(
    `  ${contract.address}: watermark ${watermark}, pending [${[
      pending.needsUpgrade ? "UpgradeContract" : undefined,
      pending.needsDataSources ? "SetDataSources" : undefined,
      pending.needsWormhole ? "SetWormholeAddress" : undefined,
    ]
      .filter(Boolean)
      .join(", ")}]`,
  );

  if (
    !pending.needsUpgrade &&
    !pending.needsDataSources &&
    !pending.needsWormhole
  ) {
    console.log("    already cut over, nothing to do");
    return;
  }
  if (pending.needsDataSources && !pending.needsWormhole) {
    throw new Error(
      "SetDataSources is pending but SetWormholeAddress is already applied, which should be " +
        "impossible in sequence order. Refusing to touch this proxy.",
    );
  }

  // The VAA is what executes, so the store has to agree with it before we send anything. A
  // mismatch means the store was edited, or these VAAs came from a different deploy run.
  const receiver = expectedReceiver(triple);
  const storeReceiver = findWormholeContract(
    contract.getChain(),
    deploymentType,
  );
  if (storeReceiver === undefined) {
    throw new Error(
      `No ${deploymentType} wormhole receiver in the store for this chain, so the outcome cannot be ` +
        `checked against anything. Run the deploy phase first.`,
    );
  }
  if (normalizeAddress(storeReceiver.address) !== receiver) {
    throw new Error(
      `SetWormholeAddress names receiver 0x${receiver} but the store has ` +
        `${storeReceiver.address} for ${deploymentType}. Refusing to execute a VAA that disagrees ` +
        `with the store.`,
    );
  }

  const atomic = !forceSequential && (await hasMulticall3(contract));
  if (!atomic && pending.needsDataSources) {
    console.log(
      `    ! ${forceSequential ? "--force-sequential set" : `no Multicall3 on ${contract.getChain().getId()}`}: ` +
        `sending two transactions. Between them this proxy can verify no price update.`,
    );
  }

  if (privateKey === undefined) {
    if (!pending.needsDataSources) {
      console.log(
        "    would send: SetWormholeAddress alone, to close the window this proxy is stranded in",
      );
    } else if (atomic) {
      console.log(
        "    would send: UpgradeContract, then SetDataSources + SetWormholeAddress via Multicall3",
      );
    } else {
      console.log(
        "    would send: UpgradeContract, then SetDataSources, then SetWormholeAddress",
      );
    }
    return;
  }

  if (pending.needsUpgrade) {
    const { id } = await contract.executeGovernanceInstruction(
      privateKey,
      triple.upgrade.vaa,
    );
    console.log(`    UpgradeContract tx ${id}`);
  }

  if (pending.needsDataSources && pending.needsWormhole) {
    const vaas = [triple.setDataSources.vaa, triple.setWormholeAddress.vaa];
    if (atomic) {
      const hash = await executeTogether(contract, privateKey, vaas);
      console.log(`    SetDataSources + SetWormholeAddress tx ${hash}`);
    } else {
      const hashes = await executeSeparately(contract, privateKey, vaas);
      console.log(`    SetDataSources tx ${hashes[0]}`);
      console.log(`    SetWormholeAddress tx ${hashes[1]}`);
    }
  } else if (pending.needsWormhole) {
    // Stranded between VAA2 and VAA3: this proxy can verify nothing until VAA3 lands, so send it
    // on its own rather than insisting on a pair that no longer exists.
    const { id } = await contract.executeGovernanceInstruction(
      privateKey,
      triple.setWormholeAddress.vaa,
    );
    console.log(
      `    SetWormholeAddress tx ${id} (recovering a stranded proxy)`,
    );
  }

  const warnings = await verifyCutover(
    contract,
    deploymentType,
    receiver,
    triple.setWormholeAddress.sequence,
  );
  console.log(`    ✅ verified against Pro receiver 0x${receiver}`);
  for (const warning of warnings) console.log(`    ! ${warning}`);

  if (saveContract) {
    contract.deploymentType = deploymentType;
    DefaultStore.contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
    console.log(`    store entry marked ${deploymentType}`);
  }
}

async function main() {
  const argv = await parser.argv;

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }
  let privateKey: PrivateKey | undefined;
  if (argv.privateKey !== undefined) privateKey = toPrivateKey(argv.privateKey);
  if (!argv.dryRun && privateKey === undefined) {
    throw new Error("--private-key is required unless --dry-run is set");
  }
  if (argv.toSequence < argv.fromSequence) {
    throw new Error("--to-sequence must not be below --from-sequence");
  }

  const vaultId = VAULT_BY_DEPLOYMENT_TYPE[deploymentType];
  const vault = DefaultStore.vaults[vaultId];
  if (vault === undefined) throw new Error(`Unknown vault ${vaultId}`);
  const emitter = await vault.getEmitter();
  console.log(
    `Fetching VAAs ${argv.fromSequence}..${argv.toSequence} from emitter ${emitter.toBase58()}`,
  );

  const vaas = await fetchVaas(
    emitter,
    vault.cluster,
    argv.fromSequence,
    argv.toSequence,
  );

  // The same checks a signer runs before approving. If the fetched range is not a well formed
  // cutover, stop before touching a proxy.
  const findings = reviewProposedActions(
    vaas.map((entry, index) => ({ action: entry.action, index })),
    { allowGovernanceTransfer: false },
  );
  for (const finding of findings) {
    console.log(`  ${finding.severity}  ${finding.message}`);
  }
  if (findings.some((finding) => finding.severity === "CRITICAL")) {
    throw new Error(
      "The fetched VAAs do not form a safe cutover. Refusing to execute.",
    );
  }

  console.log(`\nGrouping ${vaas.length} VAA(s) by target chain`);
  const triples = groupTriples(vaas);

  const selectedChains = getSelectedChains(argv);
  const failures: { proxy: string; error: string }[] = [];
  for (const chain of selectedChains) {
    const triple = triples.get(chain.wormholeChainName);
    console.log(`\n=== ${chain.getId()} ===`);
    if (triple === undefined) {
      console.log("  no cutover VAAs in this range for this chain, skipping");
      continue;
    }
    // Only proxies sharing this deployment type's governance emitter can execute these VAAs.
    const { governed, skipped } = await selectGovernedContracts(
      findLegacyPriceFeedContracts(chain),
      deploymentType,
    );
    for (const message of skipped) console.log(`  - skipping ${message}`);
    for (const contract of governed) {
      try {
        await cutoverProxy(
          contract,
          triple,
          deploymentType,
          privateKey,
          argv.saveContract,
          argv.forceSequential,
        );
      } catch (error) {
        const message = describeError(error);
        console.error(`  ✗ ${contract.address}: ${message}`);
        failures.push({ error: message, proxy: contract.getId() });
      }
    }
  }

  if (argv.dryRun) console.log("\n--dry-run set, nothing was sent.");
  if (failures.length > 0) {
    console.log(`\nFailed on ${failures.length} proxy(ies)`);
    for (const failure of failures) {
      console.log(`  ${failure.proxy}: ${failure.error}`);
    }
    console.log("Re-run to retry; proxies already cut over are skipped.");
    process.exit(1);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
