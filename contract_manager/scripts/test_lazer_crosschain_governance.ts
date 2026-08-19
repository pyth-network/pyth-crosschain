/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */

/**
 * End-to-end test of the Pyth Lazer crosschain attestation path against a
 * throwaway EVM testnet deployment.
 *
 * A crosschain attestation is a Wormhole VAA whose signatures come from the
 * Lazer routers rather than the Wormhole guardians. Only a `pro-compatible-*`
 * deployment accepts one: its receiver is `ReceiverImplementationHalf`, which
 * verifies at `n / 2 + 1` (what the api service assembles for) instead of the
 * stock `2 / 3 + 1`, and its governance data source is the Lazer governance
 * emitter rather than the Pyth DAO's. Nothing is deployed with
 * `pro-compatible-staging` today, so this script stands one up.
 *
 * Split in two because approving a proposal is a human step that an API key
 * cannot perform:
 *
 *   1. `propose` — deploy (or reuse) the stack, audit it against the staging
 *      regime, and open an `attest_crosschain_payload` proposal in imp carrying
 *      a `SetValidPeriod` instruction. Prints the `execute` command to run next.
 *   2. `execute` — after a reviewer approves and submits the proposal, collect
 *      the assembled VAA from the api service, execute it on the contract, and
 *      assert the state it was supposed to change actually changed.
 *
 * `SetValidPeriod` is the action because it is reversible, takes a single
 * integer, and reads back off the contract — the same reason the Lazer
 * integration suite uses it.
 */

import { parseVaa } from "@certusone/wormhole-sdk";
import {
  decodeGovernancePayload,
  SetValidPeriod,
} from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { DeploymentType } from "../src/core/base";
import { getDefaultDeploymentConfig, toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import type { BaseDeployConfig } from "./common";
import {
  deployIfNotCached,
  getOrDeployWormholeContract,
  getWeb3Contract,
} from "./common";

/** The only deployment type whose receiver and governance source accept a
 * staging Lazer attestation. Not a flag: every check in this script is written
 * against this regime, and pointing it at another one would silently test
 * nothing. */
const DEPLOYMENT_TYPE: DeploymentType = "pro-compatible-staging";

/** Separate from `.cache-deploy-evm` so a throwaway test deployment is never
 * mistaken for, or reused by, a real one. Deleting this file forces a redeploy. */
const CACHE_FILE = ".cache-lazer-crosschain-governance-test";

const DEFAULT_IMP_URL = "https://imp-staging.dourolabs.app";
const DEFAULT_LAZER_URL = "https://pyth-staging.dourolabs.app";

/** What the proxy is initialized with, and what `SetValidPeriod` moves it away
 * from. Any two distinct values work. */
const INITIAL_VALID_PERIOD_SECONDS = 60;
const DEFAULT_NEW_VALID_PERIOD_SECONDS = 4242;

/** The stack under test verifies price updates from nobody, so a fee would only
 * get in the way of the governance path this exercises. */
const SINGLE_UPDATE_FEE_IN_WEI = 0;

/** A proposal carrying an attestation may carry no other action (imp enforces
 * this), so the attestation is the instruction's only item. */
const SOLE_ITEM_INDEX = 0;

/** Routers sign as they reach the item in the transaction stream, so they answer
 * within a stream-lag of each other rather than at once. */
const VAA_POLL_INTERVAL_MS = 3000;
const DEFAULT_VAA_TIMEOUT_SECONDS = 180;

// ---------------------------------------------------------------------------
// imp and api service clients
// ---------------------------------------------------------------------------

/** The subset of `GET /api/formatted-state` this script reads. The state fields
 * are at the top level of the response — `SetStateFormattedSnapshot` flattens
 * them — so there is no `.state` wrapper to dereference. */
type FormattedState = {
  governanceSources?: {
    source?: { singleEd25519?: { publicKey?: string } };
  }[];
  multisigKeySets?: {
    current?: { guardianSetIndex?: number; keys?: string[] };
  };
  shardName?: string;
};

type ProposalDetail = {
  actions: { action_type: string; payload: { payload?: string } }[];
  id: string;
  state: string;
  title: string;
  transaction_data?: unknown;
};

type AssembledVaa = {
  signature_count: number;
  status: "assembled";
  vaa: string;
  vaa_sequence_no: number;
};

type UnavailableVaa = {
  quorum: number;
  routers_queried: number;
  routers_responded: number;
  status: "unavailable";
  valid_signatures: number;
};

/** GET when `post` is omitted, POST of that JSON body when it is given. */
async function bearerJson<T>(
  url: URL,
  token: string,
  post?: string,
): Promise<T> {
  const authorization = `Bearer ${token}`;
  const response = await fetch(
    url,
    post === undefined
      ? { headers: { authorization } }
      : {
          body: post,
          headers: { authorization, "content-type": "application/json" },
          method: "POST",
        },
  );
  if (!response.ok) {
    throw new Error(
      `${post === undefined ? "GET" : "POST"} ${url.pathname} returned ${response.status.toString()}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

function fetchState(impUrl: string, impKey: string): Promise<FormattedState> {
  return bearerJson<FormattedState>(
    new URL("/api/formatted-state", impUrl),
    impKey,
  );
}

function fetchProposal(
  impUrl: string,
  impKey: string,
  proposalId: string,
): Promise<ProposalDetail> {
  return bearerJson<ProposalDetail>(
    new URL(`/api/proposals/${proposalId}`, impUrl),
    impKey,
  );
}

// ---------------------------------------------------------------------------
// Reading the staging regime out of live state
// ---------------------------------------------------------------------------

function normalizeAddress(address: string): string {
  return address.replace(/^0x/, "").toLowerCase();
}

/** The guardian set the routers are actually signing with, as 20-byte hex. */
function guardiansFromState(state: FormattedState): string[] {
  const keys = state.multisigKeySets?.current?.keys;
  if (keys === undefined || keys.length === 0) {
    throw new Error(
      "governance state carries no current multisig key set; the routers have no guardian set to sign under",
    );
  }
  // proto-JSON encodes `bytes` as standard base64.
  return keys.map((key) => Buffer.from(key, "base64").toString("hex"));
}

/**
 * The Ed25519 key the api service addresses a signed attestation by.
 *
 * imp signs with the single governance source it is configured with, which the
 * script cannot observe directly — so this insists on there being exactly one
 * candidate rather than guessing between several. `override` is the escape
 * hatch for a state that has more.
 */
function governanceSourceKey(
  state: FormattedState,
  override: string | undefined,
): string {
  if (override !== undefined) return normalizeAddress(override);

  const keys = (state.governanceSources ?? [])
    .map((source) => source.source?.singleEd25519?.publicKey)
    .filter((key): key is string => key !== undefined)
    .map((key) => Buffer.from(key, "base64").toString("hex"));

  if (keys.length !== 1) {
    throw new Error(
      `expected exactly one single-Ed25519 governance source in state, found ${keys.length.toString()}` +
        `${keys.length === 0 ? "" : ` (${keys.join(", ")})`}. Pass --governance-source to pick one.`,
    );
  }
  // biome-ignore lint/style/noNonNullAssertion: length was just checked
  return keys[0]!;
}

/**
 * Assert the deployment is one a staging attestation can execute on.
 *
 * Worth doing on every run, not just after a deploy: the guardian set baked
 * into `getDefaultDeploymentConfig` is a constant, while the routers sign with
 * whatever is in governance state. When those drift, the api service still
 * assembles a VAA and the contract still rejects it, with nothing in either
 * message pointing at the cause.
 *
 * Returns the size of the guardian set, for reporting.
 */
async function auditDeployment(
  chain: EvmChain,
  priceFeed: EvmPriceFeedContract,
  state: FormattedState,
): Promise<number> {
  const { governanceDataSource, wormholeConfig } =
    getDefaultDeploymentConfig(DEPLOYMENT_TYPE);
  const wormhole = await priceFeed.getWormholeContract();

  const onChainGovernance = await priceFeed.getGovernanceDataSource();
  if (
    onChainGovernance.emitterChain !== governanceDataSource.emitterChain ||
    normalizeAddress(onChainGovernance.emitterAddress) !==
      normalizeAddress(governanceDataSource.emitterAddress)
  ) {
    throw new Error(
      `contract accepts governance from chain ${onChainGovernance.emitterChain.toString()} / ` +
        `${onChainGovernance.emitterAddress}, but staging attestations are emitted by chain ` +
        `${governanceDataSource.emitterChain.toString()} / ${governanceDataSource.emitterAddress}`,
    );
  }

  const receiverChainId = await wormhole.getChainId();
  if (receiverChainId !== chain.getWormholeChainId()) {
    throw new Error(
      `receiver answers for chain id ${receiverChainId.toString()} but ${chain.getId()} is ` +
        `${chain.getWormholeChainId().toString()}; a governance instruction naming either would be rejected`,
    );
  }

  const onChainGuardians = (await wormhole.getGuardianSet()).map((guardian) =>
    normalizeAddress(guardian),
  );
  const expectedGuardians = wormholeConfig.initialGuardianSet.map((guardian) =>
    normalizeAddress(guardian),
  );
  if (onChainGuardians.join(",") !== expectedGuardians.join(",")) {
    throw new Error(
      `receiver guardian set ${onChainGuardians.join(",")} is not the ${DEPLOYMENT_TYPE} set ` +
        `${expectedGuardians.join(",")}`,
    );
  }

  const liveGuardians = guardiansFromState(state).map((guardian) =>
    normalizeAddress(guardian),
  );
  if (onChainGuardians.join(",") !== liveGuardians.join(",")) {
    throw new Error(
      `the routers sign with ${liveGuardians.join(",")} but the contract verifies against ` +
        `${onChainGuardians.join(",")}. The ${DEPLOYMENT_TYPE} guardian set in ` +
        `contract_manager/src/core/base.ts has drifted from governance state and needs updating.`,
    );
  }

  const quorum = Math.floor(onChainGuardians.length / 2) + 1;
  console.log(
    `Guardian set (${onChainGuardians.length.toString()} keys, quorum ${quorum.toString()}):`,
  );
  for (const [index, guardian] of onChainGuardians.entries()) {
    console.log(`  [${index.toString()}] 0x${guardian}`);
  }
  return onChainGuardians.length;
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

/**
 * The Pyth proxy, initialized against `wormholeAddress` and the staging
 * governance emitter. Mirrors `deploy_evm_pricefeed_contracts.ts`, which keeps
 * its copy private to that script.
 */
async function deployPythProxy(
  chain: EvmChain,
  config: BaseDeployConfig,
  wormholeAddress: string,
): Promise<string> {
  const implementation = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PythUpgradable",
    [],
  );
  const { dataSources, governanceDataSource } = getDefaultDeploymentConfig(
    config.type,
  );
  const initData = getWeb3Contract(
    config.jsonOutputDir,
    "PythUpgradable",
    implementation,
  )
    .methods.initialize(
      wormholeAddress,
      dataSources.map((source) => source.emitterChain),
      dataSources.map((source) => "0x" + source.emitterAddress),
      governanceDataSource.emitterChain,
      "0x" + governanceDataSource.emitterAddress,
      // A fresh deployment has executed nothing, so any assigned sequence is
      // accepted. The shard's counter only ever climbs and is shared across
      // every attestation, so no particular starting value can be assumed.
      0,
      INITIAL_VALID_PERIOD_SECONDS,
      SINGLE_UPDATE_FEE_IN_WEI,
    )
    .encodeABI();

  return deployIfNotCached(CACHE_FILE, chain, config, "ERC1967Proxy", [
    implementation,
    initData,
  ]);
}

// ---------------------------------------------------------------------------
// Reading the retrieval key off an executed proposal
// ---------------------------------------------------------------------------

/**
 * The governance sequence number imp assigned the proposal's transaction.
 *
 * Searched for rather than read from a fixed path: `transaction_data` is
 * proto-JSON of a `LazerTransaction`, whose shape is imp's to change and whose
 * 64-bit fields are encoded as strings.
 */
function findGovernanceSequenceNo(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findGovernanceSequenceNo(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const direct = record.governanceSequenceNo;
    if (typeof direct === "string" || typeof direct === "number") {
      return String(direct);
    }
    for (const nested of Object.values(record)) {
      const found = findGovernanceSequenceNo(nested);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Collecting the assembled VAA
// ---------------------------------------------------------------------------

/**
 * Poll the api service until a quorum of routers has signed.
 *
 * Each call takes one sample of the routers, so retrying is the caller's job.
 * An unknown request key is indistinguishable from one that is merely pending —
 * both come back `unavailable` — which is why this is bounded by a deadline
 * rather than run until it succeeds.
 */
async function collectVaa(
  lazerUrl: string,
  lazerToken: string,
  request: {
    governance_sequence_no: number;
    item_index: number;
    source: { public_key: string; type: "single_ed25519" };
  },
  timeoutSeconds: number,
): Promise<AssembledVaa> {
  const url = new URL("/internal/v1/crosschain_attestation_vaa", lazerUrl);
  const body = JSON.stringify(request);
  const deadline = Date.now() + timeoutSeconds * 1000;
  let last: UnavailableVaa | undefined;

  while (Date.now() < deadline) {
    const response = await bearerJson<AssembledVaa | UnavailableVaa>(
      url,
      lazerToken,
      body,
    );
    if (response.status === "assembled") return response;

    last = response;
    console.log(
      `  waiting: ${response.valid_signatures.toString()}/${response.quorum.toString()} signatures, ` +
        `${response.routers_responded.toString()}/${response.routers_queried.toString()} routers responded`,
    );
    await new Promise((resolve) => setTimeout(resolve, VAA_POLL_INTERVAL_MS));
  }

  const settled =
    last !== undefined && last.routers_responded === last.routers_queried;
  throw new Error(
    `no VAA after ${timeoutSeconds.toString()}s; last response ${JSON.stringify(last)}. ` +
      (settled
        ? "Every router has answered, so this will not improve: either the request key is wrong " +
          "or some routers are not configured to sign attestations."
        : "Some routers have not answered yet; retry with a longer --timeout."),
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const chainOption = {
  default: "optimism_sepolia",
  desc: "EVM testnet in the contract store to deploy to and execute on",
  type: "string",
} as const;

const impKeyOption = {
  demandOption: true,
  desc: "imp API key with the ProposeAndRead scope",
  type: "string",
} as const;

const impUrlOption = {
  default: DEFAULT_IMP_URL,
  desc: "imp base URL",
  type: "string",
} as const;

const privateKeyOption = {
  demandOption: true,
  desc: "private key of the account paying for the transactions (hex, no 0x)",
  type: "string",
} as const;

const parser = yargs(hideBin(process.argv))
  .scriptName("test_lazer_crosschain_governance.ts")
  .usage(
    "Exercise the Lazer staging crosschain attestation path end to end against a throwaway " +
      `${DEPLOYMENT_TYPE} deployment.\n\n` +
      "Run `propose`, have a reviewer approve and submit the proposal in imp, then run `execute`.",
  )
  .strict()
  .demandCommand(1);

parser.command(
  "propose",
  "deploy the staging-compatible stack and open the attestation proposal in imp",
  (b) =>
    b.options({
      chain: chainOption,
      "gas-multiplier": {
        // The ERC1967 proxy's gas estimate is short on many networks.
        default: 2,
        desc: "Gas multiplier for the deployment transactions",
        type: "number",
      },
      "gas-price-multiplier": {
        default: 1,
        desc: "Gas price multiplier for the deployment transactions",
        type: "number",
      },
      "imp-key": impKeyOption,
      "imp-url": impUrlOption,
      "price-feed": {
        desc: "Reuse an already-deployed Pyth contract instead of deploying one",
        type: "string",
      },
      "private-key": privateKeyOption,
      shard: {
        desc: "Shard whose routers attest the payload (default: the shard imp reports)",
        type: "string",
      },
      "std-output-dir": {
        demandOption: true,
        desc: "Foundry output directory of target_chains/ethereum/contracts (its 'out/')",
        type: "string",
      },
      "valid-period": {
        default: DEFAULT_NEW_VALID_PERIOD_SECONDS,
        desc: "Valid time period the governance action sets, in seconds",
        type: "number",
      },
    }),
  async (argv) => {
    const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
    if (chain.isMainnet()) {
      throw new Error(
        `${chain.getId()} is mainnet. This script deploys a throwaway contract and is testnet-only.`,
      );
    }

    const state = await fetchState(argv["imp-url"], argv["imp-key"]);

    let priceFeedAddress = argv["price-feed"];
    if (priceFeedAddress === undefined) {
      const config: BaseDeployConfig = {
        gasMultiplier: argv["gas-multiplier"],
        gasPriceMultiplier: argv["gas-price-multiplier"],
        jsonOutputDir: argv["std-output-dir"],
        privateKey: toPrivateKey(argv["private-key"]),
        type: DEPLOYMENT_TYPE,
      };
      // Keyed on deployment type, so this stands up its own receiver rather
      // than reusing a `pro-compatible-production` one already on the chain.
      const wormhole = await getOrDeployWormholeContract(
        chain,
        { ...config, saveContract: false },
        CACHE_FILE,
      );
      priceFeedAddress = await deployPythProxy(chain, config, wormhole.address);
    }

    const priceFeed = new EvmPriceFeedContract(
      chain,
      priceFeedAddress,
      DEPLOYMENT_TYPE,
    );
    console.log(`\nPyth contract: ${priceFeedAddress} on ${chain.getId()}`);
    await auditDeployment(chain, priceFeed, state);

    const currentValidPeriod = await priceFeed.getValidTimePeriod();
    if (currentValidPeriod === argv["valid-period"]) {
      throw new Error(
        `the contract's valid period is already ${currentValidPeriod.toString()}s, so executing this ` +
          "instruction would prove nothing. Pass a different --valid-period.",
      );
    }

    // The receiver chain id is what the contract checks the instruction's
    // target against, and `wormholeChainName` is what resolves to it.
    const payload = new SetValidPeriod(
      chain.wormholeChainName,
      BigInt(argv["valid-period"]),
    ).encode();

    const shard = argv.shard ?? state.shardName;
    if (shard === undefined || shard === "") {
      throw new Error(
        "imp did not report a shard name; pass --shard to name the shard whose routers should attest",
      );
    }

    const { id } = await bearerJson<{ id: string }>(
      new URL("/api/proposals", argv["imp-url"]),
      argv["imp-key"],
      JSON.stringify({
        actions: [
          {
            action_type: "attest_crosschain_payload",
            payload: {
              payload: payload.toString("base64"),
              shard_name: shard,
              version: "1",
            },
          },
        ],
        title: `Crosschain attestation test: SetValidPeriod(${argv["valid-period"].toString()}) on ${chain.getId()}`,
      }),
    );

    console.log(`
Proposal ${id} created on shard '${shard}'.
  payload            0x${payload.toString("hex")}
  action             SetValidPeriod ${currentValidPeriod.toString()}s -> ${argv["valid-period"].toString()}s

Have a reviewer (not the API key's owner) approve and submit it at ${argv["imp-url"]},
then collect the VAA and execute it:

  pnpm tsx scripts/test_lazer_crosschain_governance.ts execute \\
    --chain ${chain.getId()} \\
    --price-feed ${priceFeedAddress} \\
    --proposal-id ${id} \\
    --imp-key <imp api key> \\
    --lazer-token <api internal token> \\
    --private-key <hex>

Collect promptly: router shares live in memory, so a router that restarts before
quorum loses its share for good and the proposal has to be redone.`);
  },
);

parser.command(
  "execute",
  "collect the attested VAA and execute it on the contract",
  (b) =>
    b.options({
      chain: chainOption,
      "governance-source": {
        desc: "Ed25519 public key of the governance source (hex); inferred from state when there is only one",
        type: "string",
      },
      "imp-key": impKeyOption,
      "imp-url": impUrlOption,
      "item-index": {
        default: SOLE_ITEM_INDEX,
        desc: "Position of the attestation within the governance instruction",
        type: "number",
      },
      "lazer-token": {
        demandOption: true,
        desc: "api service internal access token",
        type: "string",
      },
      "lazer-url": {
        default: DEFAULT_LAZER_URL,
        desc: "api service base URL",
        type: "string",
      },
      "price-feed": {
        demandOption: true,
        desc: "Pyth contract address printed by `propose`",
        type: "string",
      },
      "private-key": privateKeyOption,
      "proposal-id": {
        demandOption: true,
        desc: "Proposal id printed by `propose`",
        type: "string",
      },
      timeout: {
        default: DEFAULT_VAA_TIMEOUT_SECONDS,
        desc: "How long to poll the api service for a quorum, in seconds",
        type: "number",
      },
    }),
  async (argv) => {
    const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
    const priceFeed = new EvmPriceFeedContract(
      chain,
      argv["price-feed"],
      DEPLOYMENT_TYPE,
    );

    const state = await fetchState(argv["imp-url"], argv["imp-key"]);
    const guardianCount = await auditDeployment(chain, priceFeed, state);

    const proposal = await fetchProposal(
      argv["imp-url"],
      argv["imp-key"],
      argv["proposal-id"],
    );
    if (proposal.state !== "submitted" && proposal.state !== "applied") {
      throw new Error(
        `proposal ${proposal.id} is '${proposal.state}'; it has to be approved and submitted before ` +
          "the routers see anything to sign",
      );
    }

    const sequence = findGovernanceSequenceNo(proposal.transaction_data);
    if (sequence === undefined) {
      throw new Error(
        `proposal ${proposal.id} carries no governance sequence number; it has not been executed yet`,
      );
    }

    const attested = proposal.actions.find(
      (action) => action.action_type === "attest_crosschain_payload",
    )?.payload.payload;
    if (attested === undefined) {
      throw new Error(
        `proposal ${proposal.id} carries no attest_crosschain_payload action`,
      );
    }
    const expectedPayload = Buffer.from(attested, "base64").toString("hex");

    console.log(
      `\nCollecting the VAA for governance sequence ${sequence}, item ${argv["item-index"].toString()}...`,
    );
    const assembled = await collectVaa(
      argv["lazer-url"],
      argv["lazer-token"],
      {
        governance_sequence_no: Number(sequence),
        item_index: argv["item-index"],
        source: {
          public_key: governanceSourceKey(state, argv["governance-source"]),
          type: "single_ed25519",
        },
      },
      argv.timeout,
    );

    const vaa = Buffer.from(assembled.vaa, "hex");
    const parsed = parseVaa(vaa);
    console.log(
      `Assembled VAA sequence ${assembled.vaa_sequence_no.toString()} with ` +
        `${assembled.signature_count.toString()} signatures from guardian set ${parsed.guardianSetIndex.toString()}`,
    );

    // Everything below fails before spending gas on a transaction the contract
    // would revert, and names which of the checks it would have failed.
    if (parsed.payload.toString("hex") !== expectedPayload) {
      throw new Error(
        `the attested payload 0x${parsed.payload.toString("hex")} is not the one the proposal ` +
          `carries, 0x${expectedPayload}`,
      );
    }
    const action = decodeGovernancePayload(parsed.payload);
    if (!(action instanceof SetValidPeriod)) {
      throw new Error(
        `the attested payload is not a SetValidPeriod instruction: ${JSON.stringify(action)}`,
      );
    }
    if (action.targetChainId !== chain.wormholeChainName) {
      throw new Error(
        `the instruction targets '${action.targetChainId}', not '${chain.wormholeChainName}'`,
      );
    }
    const governance = await priceFeed.getGovernanceDataSource();
    if (
      parsed.emitterChain !== governance.emitterChain ||
      normalizeAddress(parsed.emitterAddress.toString("hex")) !==
        normalizeAddress(governance.emitterAddress)
    ) {
      throw new Error(
        `the VAA is emitted by chain ${parsed.emitterChain.toString()} / ` +
          `${parsed.emitterAddress.toString("hex")}, which the contract does not accept governance from`,
      );
    }
    const watermarkBefore = await priceFeed.getLastExecutedGovernanceSequence();
    if (assembled.vaa_sequence_no <= watermarkBefore) {
      throw new Error(
        `the contract has already executed governance up to sequence ${watermarkBefore.toString()}, so ` +
          `sequence ${assembled.vaa_sequence_no.toString()} would be rejected as stale`,
      );
    }

    const expectedValidPeriod = Number(action.newValidPeriod);
    const validPeriodBefore = await priceFeed.getValidTimePeriod();
    console.log(
      `\nExecuting on ${argv["price-feed"]} (valid period ${validPeriodBefore.toString()}s, ` +
        `governance watermark ${watermarkBefore.toString()})...`,
    );
    const { id } = await priceFeed.executeGovernanceInstruction(
      toPrivateKey(argv["private-key"]),
      vaa,
    );
    console.log(`  transaction ${id}`);

    const validPeriodAfter = await priceFeed.getValidTimePeriod();
    const watermarkAfter = await priceFeed.getLastExecutedGovernanceSequence();
    if (validPeriodAfter !== expectedValidPeriod) {
      throw new Error(
        `the transaction succeeded but the valid period is ${validPeriodAfter.toString()}s, not the ` +
          `${expectedValidPeriod.toString()}s the instruction asked for`,
      );
    }
    // The watermark is the replay protection: the contract requires a strictly
    // greater sequence, so consuming it is what makes this VAA single-use.
    if (watermarkAfter !== assembled.vaa_sequence_no) {
      throw new Error(
        `the governance watermark is ${watermarkAfter.toString()}, not the executed sequence ` +
          `${assembled.vaa_sequence_no.toString()}; the VAA could be replayed`,
      );
    }

    console.log(`
✅ A Lazer-router-signed VAA executed on a real contract.
   valid period          ${validPeriodBefore.toString()}s -> ${validPeriodAfter.toString()}s
   governance watermark  ${watermarkBefore.toString()} -> ${watermarkAfter.toString()} (this VAA can no longer be replayed)
   signatures            ${assembled.signature_count.toString()} of ${guardianCount.toString()} guardians`);
  },
);

parser.parseAsync();
