/** biome-ignore-all lint/suspicious/noConsole: CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

/**
 * Executes an in-place Pro cutover on one legacy EVM Pyth proxy:
 *
 *   VAA₁ UpgradeContract          — its own transaction (skipped if already applied)
 *   VAA₂ SetDataSources +
 *   VAA₃ SetWormholeAddress       — one Multicall3 transaction
 *
 * Does not fall back to two sequential txs if Multicall3 is missing; that would
 * leave a window where neither legacy nor Pro price updates verify.
 *
 * Usage: pnpm tsx scripts/execute_evm_cutover_vaas.ts \
 *   --chain <chain> --private-key <key> --upgrade-sequence <n> \
 *   --deployment-type pro-compatible-production|pro-compatible-staging
 */

import { parseVaa } from "@certusone/wormhole-sdk";
import type { PythGovernanceAction } from "@pythnetwork/xc-admin-common";
import {
  decodeGovernancePayload,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  SetDataSources,
} from "@pythnetwork/xc-admin-common";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  getDefaultDeploymentConfig,
  toDeploymentType,
  toPrivateKey,
} from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { SubmittedWormholeMessage } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { COMMON_DEPLOY_OPTIONS } from "./common";
import {
  dataSourcesEqual,
  findLegacyEvmPriceFeedContract,
  getOpsVault,
  governanceDataSourcesEqual,
  normalizeHex,
  requireProCompatibleDeploymentType,
} from "./evm_pro_cutover";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL3_ABI = [
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

const parser = yargs(hideBin(process.argv))
  .scriptName("execute_evm_cutover_vaas.ts")
  .usage(
    "Executes cutover VAAs on a legacy EVM Pyth proxy: UpgradeContract alone, then SetDataSources+SetWormholeAddress via Multicall3.\n" +
      "Usage: $0 --chain <chain> --private-key <private-key> --upgrade-sequence <n> --deployment-type <pro-compatible-production|pro-compatible-staging>",
  )
  .options({
    chain: {
      demandOption: true,
      desc: "Chain whose legacy Pyth proxy should execute the cutover VAAs",
      type: "string",
    },
    "data-sources-sequence": {
      desc: "Vault sequence of the SetDataSources VAA. Defaults to upgrade-sequence + 1",
      type: "number",
    },
    "deployment-type": {
      demandOption: true,
      desc: "Must be pro-compatible-production or pro-compatible-staging",
      type: "string",
    },
    dryrun: {
      default: false,
      desc: "Fetch and decode VAAs without sending transactions",
      type: "boolean",
    },
    "gas-price-multiplier": COMMON_DEPLOY_OPTIONS["gas-price-multiplier"],
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    save: {
      default: false,
      desc: "After success, assert on-chain state vs Pro config and set the store deploymentType",
      type: "boolean",
    },
    "upgrade-sequence": {
      demandOption: true,
      desc: "Vault sequence of the UpgradeContract VAA (VAA₁)",
      type: "number",
    },
    vault: {
      choices: ["mainnet", "devnet"] as const,
      desc: "Ops vault used to fetch VAAs. Defaults to mainnet for mainnet chains and devnet for testnet",
      type: "string",
    },
    "wormhole-sequence": {
      desc: "Vault sequence of the SetWormholeAddress VAA. Defaults to upgrade-sequence + 2",
      type: "number",
    },
  });

async function fetchVaultVaa(
  vault: ReturnType<typeof getOpsVault>,
  sequence: number,
): Promise<Buffer> {
  const submitted = new SubmittedWormholeMessage(
    await vault.getEmitter(),
    sequence,
    vault.cluster,
  );
  return submitted.fetchVaa();
}

function requireAction<T extends PythGovernanceAction>(
  vaa: Buffer,
  sequence: number,
  guard: (action: PythGovernanceAction | undefined) => action is T,
  label: string,
): T {
  const parsed = parseVaa(vaa);
  const action = decodeGovernancePayload(parsed.payload);
  if (!guard(action)) {
    throw new Error(
      `Sequence ${sequence} is not ${label} (got ${action?.constructor.name ?? "unknown"})`,
    );
  }
  return action;
}

async function main() {
  const argv = await parser.argv;
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const deploymentType = toDeploymentType(argv.deploymentType);
  requireProCompatibleDeploymentType(deploymentType);

  const vaultChoice = argv.vault ?? (chain.isMainnet() ? "mainnet" : "devnet");
  const vault = getOpsVault(vaultChoice);
  const privateKey = toPrivateKey(argv.privateKey);
  const upgradeSequence = argv.upgradeSequence;
  const dataSourcesSequence = argv.dataSourcesSequence ?? upgradeSequence + 1;
  const wormholeSequence = argv.wormholeSequence ?? upgradeSequence + 2;

  const legacy = findLegacyEvmPriceFeedContract(chain);
  if (!legacy) {
    throw new Error(
      `No legacy EvmPriceFeedContract (stable/beta/unlabeled) on ${chain.getId()}`,
    );
  }

  console.log("Vault", vault.getId());
  console.log("Chain", chain.getId());
  console.log("Legacy proxy", legacy.address);
  console.log(
    `Sequences: upgrade=${upgradeSequence} dataSources=${dataSourcesSequence} wormhole=${wormholeSequence}`,
  );

  const upgradeVaa = await fetchVaultVaa(vault, upgradeSequence);
  const dataSourcesVaa = await fetchVaultVaa(vault, dataSourcesSequence);
  const wormholeVaa = await fetchVaultVaa(vault, wormholeSequence);

  const upgradeAction = requireAction(
    upgradeVaa,
    upgradeSequence,
    (action): action is EvmUpgradeContract =>
      action instanceof EvmUpgradeContract,
    "EvmUpgradeContract",
  );
  const dataSourcesAction = requireAction(
    dataSourcesVaa,
    dataSourcesSequence,
    (action): action is SetDataSources => action instanceof SetDataSources,
    "SetDataSources",
  );
  const wormholeAction = requireAction(
    wormholeVaa,
    wormholeSequence,
    (action): action is EvmSetWormholeAddress =>
      action instanceof EvmSetWormholeAddress,
    "EvmSetWormholeAddress",
  );

  for (const [label, targetChainId] of [
    ["UpgradeContract", upgradeAction.targetChainId],
    ["SetDataSources", dataSourcesAction.targetChainId],
    ["SetWormholeAddress", wormholeAction.targetChainId],
  ] as const) {
    if (targetChainId !== chain.wormholeChainName) {
      throw new Error(
        `${label} targets ${targetChainId}, not ${chain.wormholeChainName} (${chain.getId()})`,
      );
    }
  }

  console.log("Decoded actions:");
  console.log("  UpgradeContract impl", upgradeAction.address);
  console.log("  SetDataSources", dataSourcesAction.dataSources);
  console.log("  SetWormholeAddress", wormholeAction.address);

  if (argv.dryrun) {
    console.log("Dry run; not sending transactions");
    return;
  }

  const lastExecuted = await legacy.getLastExecutedGovernanceSequence();
  const upgradeVaaSequence = Number(parseVaa(upgradeVaa).sequence.toString());
  const dataSourcesVaaSequence = Number(
    parseVaa(dataSourcesVaa).sequence.toString(),
  );
  const wormholeVaaSequence = Number(parseVaa(wormholeVaa).sequence.toString());

  if (lastExecuted < upgradeVaaSequence) {
    console.log("Executing UpgradeContract in its own transaction");
    const result = await legacy.executeGovernanceInstruction(
      privateKey,
      upgradeVaa,
    );
    console.log("UpgradeContract tx", result.id);
  } else {
    console.log(
      `Skipping UpgradeContract; lastExecutedGovernanceSequence=${lastExecuted} >= ${upgradeVaaSequence}`,
    );
  }

  const lastAfterUpgrade = await legacy.getLastExecutedGovernanceSequence();
  if (lastAfterUpgrade >= wormholeVaaSequence) {
    console.log(
      `Skipping SetDataSources+SetWormholeAddress; lastExecutedGovernanceSequence=${lastAfterUpgrade} >= ${wormholeVaaSequence}`,
    );
  } else if (lastAfterUpgrade >= dataSourcesVaaSequence) {
    throw new Error(
      `SetDataSources already applied (lastExecutedGovernanceSequence=${lastAfterUpgrade}) without SetWormholeAddress. Cannot same-tx retry; recover manually. Do not send the two VAAs sequentially.`,
    );
  } else {
    const web3 = chain.getWeb3();
    const code = await web3.eth.getCode(MULTICALL3_ADDRESS);
    if (!code || code === "0x" || code === "0x0") {
      throw new Error(
        `Multicall3 is not deployed at ${MULTICALL3_ADDRESS} on ${chain.getId()}. ` +
          "SetDataSources and SetWormholeAddress must execute in the same transaction; " +
          "use a bundler or custom batcher. This script will not send two sequential txs.",
      );
    }

    const { address: from } = web3.eth.accounts.wallet.add(privateKey);
    const pythContract = legacy.getContract();
    const dsCallData = pythContract.methods
      .executeGovernanceInstruction("0x" + dataSourcesVaa.toString("hex"))
      .encodeABI();
    const whCallData = pythContract.methods
      .executeGovernanceInstruction("0x" + wormholeVaa.toString("hex"))
      .encodeABI();

    const multicall = new web3.eth.Contract(MULTICALL3_ABI, MULTICALL3_ADDRESS);
    const transactionObject = multicall.methods.aggregate3([
      {
        allowFailure: false,
        callData: dsCallData,
        target: legacy.address,
      },
      {
        allowFailure: false,
        callData: whCallData,
        target: legacy.address,
      },
    ]);

    console.log(
      `Executing SetDataSources + SetWormholeAddress in one Multicall3 tx on ${legacy.address}`,
    );
    const result = await chain.estiamteAndSendTransaction(
      transactionObject,
      { from },
      argv.gasPriceMultiplier,
    );
    console.log("Multicall3 tx", result.transactionHash);
  }

  if (!argv.save) {
    return;
  }

  const expected = getDefaultDeploymentConfig(deploymentType);
  const onChainWormhole = await legacy.getWormholeContract();
  const onChainDataSources = await legacy.getDataSources();
  const onChainGovernance = await legacy.getGovernanceDataSource();
  const onChainSequence = await legacy.getLastExecutedGovernanceSequence();
  const onChainFee = await legacy.getBaseUpdateFee();

  const expectedWormhole = normalizeHex(wormholeAction.address);
  const actualWormhole = normalizeHex(onChainWormhole.address);
  if (actualWormhole !== expectedWormhole) {
    throw new Error(
      `On-chain wormhole() ${onChainWormhole.address} != SetWormholeAddress ${wormholeAction.address}`,
    );
  }
  if (!dataSourcesEqual(onChainDataSources, expected.dataSources)) {
    throw new Error(
      `On-chain validDataSources do not match ${deploymentType} config. On-chain=${JSON.stringify(onChainDataSources)} expected=${JSON.stringify(expected.dataSources)}`,
    );
  }
  if (
    !governanceDataSourcesEqual(
      onChainGovernance,
      expected.governanceDataSource,
    )
  ) {
    throw new Error(
      `On-chain governanceDataSource changed. On-chain=${JSON.stringify(onChainGovernance)} expected=${JSON.stringify(expected.governanceDataSource)}`,
    );
  }
  if (onChainSequence !== wormholeVaaSequence) {
    throw new Error(
      `lastExecutedGovernanceSequence=${onChainSequence}, expected VAA₃ sequence ${wormholeVaaSequence}`,
    );
  }
  if (BigInt(onChainFee.amount) !== BigInt(expected.initialSingleUpdateFee)) {
    throw new Error(
      `singleUpdateFeeInWei=${onChainFee.amount}, expected ${expected.initialSingleUpdateFee}`,
    );
  }

  legacy.deploymentType = deploymentType;
  DefaultStore.contracts[legacy.getId()] = legacy;
  DefaultStore.saveAllContracts();
  console.log(
    `Saved ${legacy.getId()} deploymentType=${deploymentType}. Historical legacy wormhole contracts are left in the store. Proxy address unchanged.`,
  );
}

main();
