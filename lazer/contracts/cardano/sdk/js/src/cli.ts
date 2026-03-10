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
  withdrawScriptHash,
} from "./transactions.js";
import { execFileAsync } from "./utils.js";
import { prepareGovernanceAction, prepareGuardianSetVAAs } from "./wormhole.js";

async function initAndUpgradeWormhole(ctx: ClientContext, mainnet: boolean) {
  const wormholeOrigin = await ctx.getOriginUtxo();
  console.info("Picked Wormhole origin:", UTxO.toOutRefString(wormholeOrigin));

  const initialGuardian = mainnet
    ? // see `env/default.ak`
      "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"
    : "13947bd48b18e53fdaeee77f3473391ac727c638";
  const upgrades = mainnet ? await prepareGuardianSetVAAs() : [];

  const wormhole = await initWormholeState(
    ctx,
    wormholeOrigin,
    initialGuardian,
  );
  const wormholeDigest = await ctx.run(wormhole.tx);
  console.info(
    "Initialized Pyth Wormhole:",
    TransactionHash.toHex(wormholeDigest),
  );

  console.info("Upgrading Pyth Wormhole...");
  for (const upgrade of upgrades) {
    console.info(`...to guardian set #${upgrade.index}...`);
    const digest = await ctx.run(
      await applyGuardianSetUpgrade(
        ctx,
        PolicyId.toHex(wormhole.policy),
        upgrade,
      ),
    );
    console.info(`(Digest: ${TransactionHash.toHex(digest)})`);
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
  verbose: {
    default: false,
    description: "whether to enable verbose logging",
    type: "boolean",
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
      "koios-key": commonOptions.koiosKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      verbose: commonOptions.verbose,
    }),
  async ({
    emitterAddress,
    emitterChain,
    koiosKey,
    mnemonic,
    network,
    verbose,
  }) => {
    const ctx = await ClientContext.create(network, mnemonic, koiosKey, {
      debug: verbose,
    });

    console.info("Initializing Pyth Wormhole...");
    const whPolicy = await initAndUpgradeWormhole(ctx, network === "mainnet");

    console.info("Initializing Pyth...");
    const pythOrigin = await ctx.getOriginUtxo();
    console.info("Picked Pyth origin:", UTxO.toOutRefString(pythOrigin));
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
      verbose: commonOptions.verbose,
      wormhole: commonOptions.wormhole,
    }),
  async ({
    koiosKey,
    mnemonic,
    network,
    state: statePolicy,
    vaa,
    verbose,
    wormhole: wormholePolicy,
  }) => {
    const prepared = prepareGovernanceAction(Buffer.from(vaa, "hex"));
    console.log(`Executing ${prepared.action.action}...`);

    const envs: Record<string, "preview" | "preprod" | undefined> = {
      cardano_preprod: "preprod",
      cardano_preview: "preview",
    };
    const ctx = await ClientContext.create(network, mnemonic, koiosKey, {
      debug: verbose,
    });
    const digest = await ctx.run(
      await applyGovernanceAction(
        ctx,
        wormholePolicy,
        statePolicy,
        prepared,
        envs[prepared.action.targetChainId],
      ),
    );
    console.log("Digest:", TransactionHash.toHex(digest));
  },
);

parser.command(
  "withdraw-script-hash",
  "Computes withdraw script hash",
  (b) => b.options({ state: commonOptions.state }),
  ({ state }) => {
    console.log("Hash:", withdrawScriptHash(state));
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
      verbose: commonOptions.verbose,
      wormhole: commonOptions.wormhole,
    }),
  async ({
    koiosKey,
    network: networkId,
    mnemonic,
    state: statePolicy,
    verbose,
    wormhole: wormholePolicy,
  }) => {
    console.info("Purging expired withdraw scripts...");
    const ctx = await ClientContext.create(networkId, mnemonic, koiosKey, {
      debug: verbose,
    });
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
