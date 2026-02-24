/** biome-ignore-all lint/suspicious/noConsole: this is CLI script */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient, Either } from "@evolution-sdk/evolution";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint";
import {
  DEFAULT_CODEGEN_CONFIG,
  generateTypeScript,
} from "@evolution-sdk/evolution/blueprint";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runDevnetSession } from "./devnet.js";
import { initPythState, initWormholeState } from "./transactions.js";
import type { TransactionContext } from "./utils.js";
import { execFileAsync, getOriginUtxo } from "./utils.js";

const getClient = (networkId: NetworkId | "custom", mnemonic: string) =>
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
  const client = getClient(networkId, mnemonic);
  const parameters = await client.getProtocolParameters();
  return {
    client,
    parameters: { ...parameters, networkId },
  };
}

const parser = yargs().usage(
  "Deployment, upgrades and management of Cardano Pyth Lazer contracts",
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
    }),
  async ({ network: networkId, mnemonic, emitterChain, emitterAddress }) => {
    const ctx = await getCtx(networkId, mnemonic);

    const wormholeOrigin = await getOriginUtxo(ctx.client);
    const wormhole = await initWormholeState(ctx, wormholeOrigin);
    const wormholeTx = await wormhole.tx
      .collectFrom({ inputs: [wormholeOrigin] })
      .buildEither({ debug: true });
    const wormholeDigest = await Either.getOrThrowWith(wormholeTx, (e) =>
      JSON.stringify(e, undefined, 2),
    ).signAndSubmit();
    await ctx.client.awaitTx(wormholeDigest);

    const pythOrigin = await getOriginUtxo(ctx.client);
    const pyth = await initPythState(ctx, pythOrigin, {
      emitter_address: Buffer.from(emitterAddress, "hex"),
      emitter_chain: BigInt(emitterChain),
      wormhole: wormhole.policy_id.hash,
    });
    const pythTx = await pyth.tx
      .collectFrom({ inputs: [pythOrigin] })
      .buildEither({ debug: true });
    const pythDigest = await Either.getOrThrowWith(pythTx, (e) =>
      JSON.stringify(e, undefined, 2),
    ).signAndSubmit();
    await ctx.client.awaitTx(pythDigest);

    console.log(
      "Wallet: ",
      JSON.stringify(await ctx.client.getWalletUtxos(), undefined, 2),
    );
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
    const client = getClient("custom", process.env.CARDANO_MNEMONIC);
    await runDevnetSession(client).catch(console.error);
  },
);

await parser.parseAsync(hideBin(process.argv));
