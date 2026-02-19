/** biome-ignore-all lint/suspicious/noConsole: this is CLI script */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import type { SigningClient } from "@evolution-sdk/evolution";
import { Cardano, createClient, Data, Either } from "@evolution-sdk/evolution";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint";
import {
  DEFAULT_CODEGEN_CONFIG,
  generateTypeScript,
} from "@evolution-sdk/evolution/blueprint";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runDevnetSession } from "./devnet.js";
import {
  Wormhole_state_init_mint,
  Wormhole_state_update_spend,
} from "./offchain.js";
import { MintingValidator, SpendingValidator, toMe } from "./transaction.js";

function getClient(
  network: NetworkId | "custom",
  mnemonic: string,
): SigningClient {
  return createClient({
    network: network === "custom" ? 0 : network,
    provider:
      network === "custom"
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
              }[network]
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
}

const execFileAsync = promisify(execFile);

const parser = yargs().usage(
  "Deployment, upgrades and management of Cardano Pyth Lazer contracts",
);

parser.command(
  "build",
  "build contracts and off-chain bindings",
  (b) =>
    b.options({
      "trace-level": {
        choices: ["silent", "compact", "verbose"] as const,
        default: "compact",
        demandOption: true,
      },
    }),
  async ({ traceLevel }) => {
    await execFileAsync("aiken", [
      "build",
      path.resolve(import.meta.dirname, "../../../"),
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
  async ({ network, mnemonic }) => {
    const client = getClient(network, mnemonic);

    const [origin] = await client.getWalletUtxos();
    if (!origin) {
      throw new Error("No UTxO to use as origin");
    }

    const { coinsPerUtxoByte } = await client.getProtocolParameters();

    const spending = SpendingValidator.new(Wormhole_state_update_spend);
    const spendingScript = spending.script();
    const minting = MintingValidator.new(Wormhole_state_init_mint);
    const mintingScript = minting.script(
      { output_index: origin.index, transaction_id: origin.transactionId.hash },
      spendingScript.hash.hash,
    );
    const stateToken = mintingScript.asset(
      Cardano.AssetName.fromBytes(Buffer.from("Pyth State", "utf-8")),
      1n,
    );
    const ownerToken = mintingScript.asset(
      Cardano.AssetName.fromBytes(Buffer.from("Pyth Ops", "utf-8")),
      1n,
    );
    const stateOutput = spendingScript.receive(
      stateToken,
      {
        set: [Buffer.from("58cc3ae5c097b213ce3c81979e1b9f9570746aa5", "hex")],
        set_index: 0n,
      },
      { coinsPerUtxoByte },
    );

    const tx = await client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(mintingScript)
      .mintAssets(
        minting.mint(
          Cardano.Assets.merge(stateToken, ownerToken),
          Data.constr(0n, []),
        ),
      )
      .payToAddress(stateOutput)
      .payToAddress(await toMe(client, ownerToken))
      .buildEither({ debug: true });

    const digest = await Either.getOrThrowWith(tx, (e) => {
      throw JSON.stringify(e, undefined, 2);
    }).signAndSubmit();

    await client.awaitTx(digest);

    console.log(
      "Wallet: ",
      JSON.stringify(await client.getWalletUtxos(), undefined, 2),
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
