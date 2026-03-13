/** biome-ignore-all lint/suspicious/noConsole: this is a CLI */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  Address,
  createClient,
  PolicyId,
  PrivateKey,
  TransactionHash,
} from "@evolution-sdk/evolution";
import { generateTypeScript } from "@evolution-sdk/evolution/blueprint/codegen";
import { createCodegenConfig } from "@evolution-sdk/evolution/blueprint/codegen-config";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint/types";
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
  verifyUpdates,
  withdrawScriptHash,
} from "./transactions.js";
import { execFileAsync } from "./utils.js";
import { prepareGovernanceAction, prepareGuardianSetVAAs } from "./wormhole.js";

async function createCtx(
  network: Network,
  apiKey?: string,
  mnemonic?: string,
  verbose = false,
): Promise<ClientContext> {
  return await ClientContext.create(
    network,
    // { token: apiKey ?? process.env.KOIOS_API_KEY ?? "", type: "koios" },
    {
      projectId: apiKey ?? process.env.BLOCKFROST_API_KEY ?? "",
      type: "blockfrost",
    },
    mnemonic ?? process.env.CARDANO_MNEMONIC ?? "",
    { debug: verbose },
  );
}

async function initAndUpgradeWormhole(
  ctx: ClientContext,
  mainnet: boolean,
): Promise<PolicyId.PolicyId> {
  const initialGuardian = mainnet
    ? // see `env/default.ak`
      "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"
    : "13947bd48b18e53fdaeee77f3473391ac727c638";
  const upgrades = mainnet ? await prepareGuardianSetVAAs() : [];

  const [wormholeDigest, wormhole] = await ctx.run(() =>
    initWormholeState(ctx, initialGuardian),
  );
  console.info(
    "Initialized Pyth Wormhole:",
    TransactionHash.toHex(wormholeDigest),
  );

  console.info("Upgrading Pyth Wormhole...");
  for (const upgrade of upgrades) {
    console.info(`...to guardian set #${upgrade.index}...`);
    const [digest] = await ctx.run(() =>
      applyGuardianSetUpgrade(ctx, PolicyId.toHex(wormhole), upgrade),
    );
    console.info(`(Digest: ${TransactionHash.toHex(digest)})`);
  }
  console.info("...done.");

  return wormhole;
}

const parser = yargs().usage(
  "Deployment, upgrades and management of Cardano Pyth Lazer contracts",
);

const commonOptions = {
  apiKey: {
    description: "API key to use",
    type: "string",
  },
  mnemonic: {
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
} as const;

parser.command(
  "new-wallet",
  "generates a new wallet mnemonic and appends it to .env",
  (b) => b.options({}),
  async () => {
    const mnemonic = PrivateKey.generateMnemonic();
    const envPath = path.resolve(import.meta.dirname, "../.env");
    await fs.appendFile(envPath, `\nCARDANO_MNEMONIC="${mnemonic}"\n`);
    const address = await createClient({
      network: 0,
      wallet: { mnemonic, type: "seed" },
    }).address();
    console.log("Funding address:", Address.toBech32(address));
  },
);

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
      "api-key": commonOptions.apiKey,
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
      verbose: commonOptions.verbose,
    }),
  async ({
    apiKey,
    emitterAddress,
    emitterChain,
    mnemonic,
    network,
    verbose,
  }) => {
    const ctx = await createCtx(network, apiKey, mnemonic, verbose);

    console.info("Initializing Pyth Wormhole...");
    const whPolicy = await initAndUpgradeWormhole(ctx, network === "mainnet");

    console.info("Initializing Pyth...");
    const [pythDigest, pyth] = await ctx.run(() =>
      initPythState(ctx, {
        emitter_address: Buffer.from(emitterAddress, "hex"),
        emitter_chain: BigInt(emitterChain),
        wormhole: whPolicy.hash,
      }),
    );
    console.info("Initialized Pyth:", TransactionHash.toHex(pythDigest));

    console.info("Pyth Wormhole Policy ID:", PolicyId.toHex(whPolicy));
    console.info("Pyth Policy ID:", PolicyId.toHex(pyth));
  },
);

parser.command(
  "execute",
  "Executes supported governance action, using provided VAA",
  (b) =>
    b.options({
      "api-key": commonOptions.apiKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: commonOptions.state,
      vaa: {
        demandOption: true,
        description: "VAA encoded as a hex string",
        type: "string",
      },
      verbose: commonOptions.verbose,
    }),
  async ({ apiKey, mnemonic, network, state, vaa, verbose }) => {
    const ctx = await createCtx(network, apiKey, mnemonic, verbose);

    const prepared = prepareGovernanceAction(Buffer.from(vaa, "hex"));
    console.log(`Executing ${prepared.action.action}...`);

    const envs: Record<string, "preview" | "preprod" | undefined> = {
      cardano_preprod: "preprod",
      cardano_preview: "preview",
    };
    const [digest] = await ctx.run(() =>
      applyGovernanceAction(
        ctx,
        state,
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
      "api-key": commonOptions.apiKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: commonOptions.state,
      verbose: commonOptions.verbose,
    }),
  async ({ apiKey, network, mnemonic, state, verbose }) => {
    console.info("Purging expired withdraw scripts...");
    const ctx = await createCtx(network, apiKey, mnemonic, verbose);

    const [digest] = await ctx.run(() =>
      purgeExpiredPythWithdrawScripts(ctx, state),
    );
    console.log("Digest:", TransactionHash.toHex(digest));
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

parser.command(
  "verify-updates",
  "submits a test transaction for verifying price updates on-chain",
  (b) =>
    b.options({
      "api-key": commonOptions.apiKey,
      mnemonic: commonOptions.mnemonic,
      network: commonOptions.network,
      state: commonOptions.state,
      update: {
        array: true,
        demandOption: true,
        description: "updates to verify as hex-encoded payloads",
        type: "string",
      },
      verbose: commonOptions.verbose,
    }),
  async ({ apiKey, mnemonic, network, update, state, verbose }) => {
    const ctx = await createCtx(network, apiKey, mnemonic, verbose);

    const [digest] = await ctx.run(() =>
      verifyUpdates(
        ctx,
        state,
        update.map((u) => Buffer.from(u, "hex")),
      ),
    );
    console.info("Digest:", TransactionHash.toHex(digest));
  },
);

await parser.parseAsync(hideBin(process.argv));
