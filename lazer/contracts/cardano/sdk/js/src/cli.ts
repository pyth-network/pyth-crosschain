/** biome-ignore-all lint/suspicious/noConsole: this is a CLI */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  createClient,
  PolicyId,
  TransactionHash,
  UTxO,
} from "@evolution-sdk/evolution";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint";
import {
  DEFAULT_CODEGEN_CONFIG,
  generateTypeScript,
} from "@evolution-sdk/evolution/blueprint";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import type { SlotConfig } from "@evolution-sdk/evolution/Time";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runDevnetSession } from "./devnet.js";
import {
  applyGuardianSetUpgrade,
  initPythState,
  initWormholeState,
  purgeExpiredPythWithdrawScripts,
} from "./transactions.js";
import type { TransactionContext } from "./utils.js";
import { execFileAsync, getOriginUtxo, newTxCtx, runTx } from "./utils.js";
import { prepareGuardianSetVAAs } from "./wormhole.js";

async function getCustomSlotConfig(): Promise<SlotConfig> {
  const healthRes = await fetch("http://127.0.0.1:1337/health");
  const { startTime } = await healthRes.json();

  const summariesRes = await fetch("http://localhost:1337", {
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "queryLedgerState/eraSummaries",
    }),
    method: "POST",
  });
  const { result: summaries } = await summariesRes.json();
  const { slotLength } = summaries[summaries.length - 1].parameters;

  return {
    slotLength: slotLength.milliseconds,
    zeroSlot: 0n,
    zeroTime: BigInt(Date.parse(startTime)),
  };
}

const getClient = async (
  networkId: NetworkId | "custom",
  mnemonic: string,
  slotConfig?: SlotConfig,
) =>
  createClient({
    network: networkId === "custom" ? 0 : networkId,
    provider:
      networkId === "custom"
        ? {
            kupoUrl: "http://localhost:1442",
            ogmiosUrl: "http://localhost:1337",
            type: "kupmios",
          }
        : {
            baseUrl: `https://${
              {
                mainnet: "api",
                preprod: "preprod",
                preview: "preview",
              }[networkId]
            }.koios.rest/api/v1`,
            ...(process.env.KOIOS_API_KEY
              ? { token: process.env.KOIOS_API_KEY }
              : {}),
            type: "koios",
          },
    ...(slotConfig ? { slotConfig } : {}),
    wallet: {
      accountIndex: 0,
      mnemonic,
      type: "seed",
    },
  });

async function getCtx(
  networkId: NetworkId | "custom",
  mnemonic: string,
): Promise<TransactionContext> {
  const client = await getClient(
    networkId,
    mnemonic,
    networkId === "custom" ? await getCustomSlotConfig() : undefined,
  );
  return newTxCtx(client, networkId);
}

async function initAndUpgradeWormhole(ctx: TransactionContext) {
  const wormholeOrigin = await getOriginUtxo(ctx.client);
  console.info(
    `Picked Wormhole origin: ${UTxO.toOutRefString(wormholeOrigin)}`,
  );

  const wormhole = await initWormholeState(ctx, wormholeOrigin);
  const wormholeDigest = await runTx(ctx, wormhole.tx);
  console.info("Initialized Pyth Wormhole:", wormholeDigest);

  console.info("Upgrading Pyth Wormhole...");
  const upgrades = await prepareGuardianSetVAAs();
  for (const upgrade of upgrades) {
    console.info(`...to guardian set #${upgrade.index}...`);
    const digest = await runTx(
      ctx,
      await applyGuardianSetUpgrade(
        ctx,
        PolicyId.toHex(wormhole.policy),
        upgrade,
      ),
    );
    console.info(`(Digest: ${digest})`);
  }
  console.info("...done.");

  return wormhole.policy;
}

const parser = yargs().usage(
  "Deployment, upgrades and management of Cardano Pyth Lazer contracts",
);

const commonOptions = {
  mnemonic: {
    default: process.env.CARDANO_MNEMONIC,
    demandOption: true,
    description: "wallet mnemonic to use",
    type: "string",
  },
  network: {
    choices: ["mainnet", "preprod", "preview", "custom"] as const,
    default: process.env.CARDANO_NETWORK as NetworkId | undefined,
    demandOption: true,
    description: "Cardano network to use",
  },
} as const;

parser.command(
  "build",
  "build contracts and off-chain bindings",
  (b) =>
    b.options({
      env: {
        choices: ["preview", "preprod", "default"] as const,
        default: "default",
      },
      "trace-level": {
        choices: ["silent", "compact", "verbose"] as const,
        default: "compact",
        demandOption: true,
      },
    }),
  async ({ env, traceLevel }) => {
    await execFileAsync("aiken", [
      "build",
      path.resolve(import.meta.dirname, "../../../"),
      "--env",
      env,
      "--trace-level",
      traceLevel,
    ]);
    const blueprint = (await import("../../../plutus.json"))
      .default as PlutusBlueprint;

    const offchainSrc = generateTypeScript(blueprint, {
      ...DEFAULT_CODEGEN_CONFIG,
      imports: {
        data: [
          "/** biome-ignore-all assist/source/useSortedKeys: generated code */",
          "/** biome-ignore-all assist/source/organizeImports: generated code */",
          'import { Data } from "@evolution-sdk/evolution";',
        ].join("\n"),
        tschema: 'import { TSchema } from "@evolution-sdk/evolution";',
      },
      useSuspend: false,
    });
    await fs.writeFile(
      path.resolve(import.meta.dirname, "./offchain.ts"),
      offchainSrc,
    );
  },
);

parser.command(
  "init",
  "initialize on-chain state of contracts",
  (b) =>
    b.options({
      "emitter-address": {
        demandOption: true,
        description: "emitter chain address",
        type: "string",
      },
      "emitter-chain": {
        default: 1, // Solana
        description: "emitter chain ID",
        type: "number",
      },
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
    }),
  async ({ network: networkId, mnemonic, emitterChain, emitterAddress }) => {
    const ctx = await getCtx(networkId, mnemonic);

    console.info("Initializing Pyth Wormhole...");
    const whPolicy = await initAndUpgradeWormhole(ctx);

    console.info("Initializing Pyth...");
    const pythOrigin = await getOriginUtxo(ctx.client);
    const pyth = await initPythState(ctx, pythOrigin, {
      emitter_address: Buffer.from(emitterAddress, "hex"),
      emitter_chain: BigInt(emitterChain),
      wormhole: whPolicy.hash,
    });
    const pythDigest = await runTx(
      ctx,
      pyth.tx.collectFrom({ inputs: [pythOrigin] }),
    );
    console.info("Initialized Pyth:", TransactionHash.toHex(pythDigest));

    console.info("Pyth Wormhole Policy ID:", PolicyId.toHex(whPolicy));
    console.info("Pyth Policy ID:", PolicyId.toHex(pyth.policy));
  },
);

parser.command(
  "purge-withdraw-scripts",
  "Removes expired withdraw scripts",
  (b) =>
    b.options({
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: {
        demandOption: true,
        description: "Policy ID of the state token",
        type: "string",
      },
      wormhole: {
        demandOption: true,
        description: "Policy ID of the Wormhole state token",
        type: "string",
      },
    }),
  async ({
    network: networkId,
    mnemonic,
    state: statePolicy,
    wormhole: wormholePolicy,
  }) => {
    console.info("Purging expired withdraw scripts...");
    const ctx = await getCtx(networkId, mnemonic);
    const digest = await runTx(
      ctx,
      await purgeExpiredPythWithdrawScripts(ctx, wormholePolicy, statePolicy),
    );
    console.log("Digest:", digest);
  },
);

parser.command(
  "devnet",
  "start local devnet",
  (b) => b.options({}),
  async () => {
    if (!process.env.CARDANO_MNEMONIC) {
      throw new Error("missing CARDANO_MNEMONIC");
    }
    const client = await getClient("custom", process.env.CARDANO_MNEMONIC);
    await runDevnetSession(client).catch(console.error);
  },
);

await parser.parseAsync(hideBin(process.argv));
