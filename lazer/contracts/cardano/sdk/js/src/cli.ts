/** biome-ignore-all lint/suspicious/noConsole: this is a CLI */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PolicyId, TransactionHash, UTxO } from "@evolution-sdk/evolution";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint";
import {
  createCodegenConfig,
  generateTypeScript,
} from "@evolution-sdk/evolution/blueprint";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Network } from "./client.js";
import { ClientContext, getOfflineDevnetClient } from "./client.js";
import { runDevnetSession } from "./devnet.js";
import {
  applyGovernanceAction,
  applyGuardianSetUpgrade,
  initPythState,
  initWormholeState,
  purgeExpiredPythWithdrawScripts,
} from "./transactions.js";
import { execFileAsync } from "./utils.js";
import { prepareGovernanceAction, prepareGuardianSetVAAs } from "./wormhole.js";

async function initAndUpgradeWormhole(
  ctx: ClientContext,
  initialGuardian: string,
  // TODO: env used for upgrades list
) {
  const wormholeOrigin = await ctx.getOriginUtxo();
  console.info(
    `Picked Wormhole origin: ${UTxO.toOutRefString(wormholeOrigin)}`,
  );

  const wormhole = await initWormholeState(
    ctx,
    wormholeOrigin,
    initialGuardian,
  );
  const wormholeDigest = await ctx.run(wormhole.tx);
  console.info("Initialized Pyth Wormhole:", wormholeDigest);

  console.info("Upgrading Pyth Wormhole...");
  const upgrades =
    ctx.network === "mainnet" ? await prepareGuardianSetVAAs() : [];
  for (const upgrade of upgrades) {
    console.info(`...to guardian set #${upgrade.index}...`);
    const digest = await ctx.run(
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
  koiosKey: {
    default: process.env.KOIOS_API_KEY,
    demandOption: true,
    description: "Koios API key to use",
    type: "string",
  },
  mnemonic: {
    default: process.env.CARDANO_MNEMONIC,
    demandOption: true,
    description: "wallet mnemonic to use",
    type: "string",
  },
  network: {
    choices: ["mainnet", "preprod", "preview", "devnet"] as const,
    default: process.env.CARDANO_NETWORK as Network,
    demandOption: true,
    description: "Cardano network to use",
  },
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

    const offchainSrc = generateTypeScript(
      blueprint,
      createCodegenConfig({
        imports: {
          data: [
            "/** biome-ignore-all assist/source/useSortedKeys: generated code */",
            "/** biome-ignore-all assist/source/organizeImports: generated code */",
            'import { Data } from "@evolution-sdk/evolution";',
          ].join("\n"),
          tschema: 'import { TSchema } from "@evolution-sdk/evolution";',
        },
        useSuspend: false,
      }),
    );
    await fs.writeFile(
      path.resolve(import.meta.dirname, "./offchain.ts"),
      offchainSrc,
    );

    console.info("Script hashes:");
    for (const { title, hash } of blueprint.validators) {
      if (!title.endsWith(".else")) {
        console.info(`  ${title}: ${hash}`);
      }
    }
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
      "initial-guardian": {
        description: "initial Wormhole guardian",
        type: "string",
      },
      "koios-key": commonOptions.koiosKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
    }),
  async ({
    emitterAddress,
    emitterChain,
    initialGuardian,
    koiosKey,
    mnemonic,
    network,
  }) => {
    const ctx = await ClientContext.create(network, mnemonic, koiosKey);

    console.info("Initializing Pyth Wormhole...");
    const whPolicy = await initAndUpgradeWormhole(
      ctx,
      initialGuardian ??
        (network === "mainnet"
          ? // see `env/default.ak`
            "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"
          : "13947bd48b18e53fdaeee77f3473391ac727c638"),
    );

    console.info("Initializing Pyth...");
    const pythOrigin = await ctx.getOriginUtxo();
    const pyth = await initPythState(ctx, pythOrigin, {
      emitter_address: Buffer.from(emitterAddress, "hex"),
      emitter_chain: BigInt(emitterChain),
      wormhole: whPolicy.hash,
    });
    const pythDigest = await ctx.run(pyth.tx);
    console.info("Initialized Pyth:", TransactionHash.toHex(pythDigest));

    console.info("Pyth Wormhole Policy ID:", PolicyId.toHex(whPolicy));
    console.info("Pyth Policy ID:", PolicyId.toHex(pyth.policy));
  },
);

parser.command(
  "execute",
  "Executes supported governance action, using provided VAA",
  (b) =>
    b.options({
      "koios-key": commonOptions.koiosKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: commonOptions.state,
      vaa: {
        demandOption: true,
        description: "VAA encoded as a hex string",
        type: "string",
      },
      wormhole: commonOptions.wormhole,
    }),
  async ({
    koiosKey,
    mnemonic,
    network,
    state: statePolicy,
    vaa,
    wormhole: wormholePolicy,
  }) => {
    const prepared = prepareGovernanceAction(Buffer.from(vaa, "hex"));
    console.log(`Executing ${prepared.action.action}...`);

    const ctx = await ClientContext.create(network, mnemonic, koiosKey);
    const digest = await ctx.run(
      await applyGovernanceAction(
        ctx,
        wormholePolicy,
        statePolicy,
        prepared,
        "preview", // TODO
      ),
    );
    console.log("Digest:", digest);
  },
);

parser.command(
  "purge-withdraw-scripts",
  "Removes expired withdraw scripts",
  (b) =>
    b.options({
      koiosKey: commonOptions.koiosKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: commonOptions.state,
      wormhole: commonOptions.wormhole,
    }),
  async ({
    koiosKey,
    network: networkId,
    mnemonic,
    state: statePolicy,
    wormhole: wormholePolicy,
  }) => {
    console.info("Purging expired withdraw scripts...");
    const ctx = await ClientContext.create(networkId, mnemonic, koiosKey);
    const digest = await ctx.run(
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
    const client = getOfflineDevnetClient(process.env.CARDANO_MNEMONIC);
    await runDevnetSession(client);
  },
);

await parser.parseAsync(hideBin(process.argv));
