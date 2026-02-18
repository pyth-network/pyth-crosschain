import {
  createClient,
  Either,
  type SigningClient,
} from "@evolution-sdk/evolution";
import type { PlutusBlueprint } from "@evolution-sdk/evolution/blueprint";
import {
  DEFAULT_CODEGEN_CONFIG,
  generateTypeScript,
} from "@evolution-sdk/evolution/blueprint";
import { Cardano } from "@evolution-sdk/evolution";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  Guardians_state_init_mint,
  Guardians_state_update_spend,
} from "./offchain.js";
import { MintingValidator, SpendingValidator } from "./validator.js";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import { runDevnetSession } from "./devnet.js";

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
                preview: "preview",
                preprod: "preprod",
              }[network]
            }.koios.rest/api/v1`,
            token: process.env.KOIOS_API_KEY!,
            type: "koios",
          },
    wallet: {
      mnemonic,
      type: "seed",
      accountIndex: 0,
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
        demandOption: true,
        description: "wallet mnemonic to use",
        type: "string",
        default: process.env.CARDANO_MNEMONIC,
      },
      network: {
        choices: ["mainnet", "preprod", "preview", "custom"] as const,
        demandOption: true,
        description: "Cardano network to use",
      },
    }),
  async ({ network, mnemonic }) => {
    const client = getClient(network === "custom" ? 0 : network, mnemonic);

    const [origin] = await client.getWalletUtxos();
    if (!origin) {
      throw new Error("No UTxO to use as origin");
    }

    const spending = SpendingValidator.new(Guardians_state_update_spend);
    const spendingScript = spending.script();
    const minting = MintingValidator.new(Guardians_state_init_mint);
    const mintingScript = minting.script(
      { transaction_id: origin.transactionId.hash, output_index: origin.index },
      spendingScript.hash.hash,
    );
    const stateToken = mintingScript.asset(
      Cardano.AssetName.fromBytes(Buffer.from("state", "utf-8")),
      1n,
    );
    const ownerToken = mintingScript.asset(
      Cardano.AssetName.fromBytes(Buffer.from("owner", "utf-8")),
      1n,
    );
    const stateOutput = spendingScript.receive(stateToken, {
      set_index: 0n,
      set: [Buffer.from("58cc3ae5c097b213ce3c81979e1b9f9570746aa5", "hex")],
    });

    const tx = await client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(mintingScript)
      .mintAssets(
        minting.mint(Cardano.Assets.merge(stateToken, ownerToken), "Never"),
      )
      .payToAddress(stateOutput)
      .payToAddress({
        address: await client.address(),
        assets: ownerToken,
      })
      .buildEither({ debug: true });

    const digest = Either.getOrThrowWith(tx, (e) => {
      throw JSON.stringify(e, undefined, 2);
    }).signAndSubmit();

    console.log("Digest: ", digest);
  },
);

parser.command(
  "devnet",
  "start local devnet",
  () => {},
  async () => {
    const client = getClient(0, process.env.CARDANO_MNEMONIC!);
    await runDevnetSession(client).catch(console.error);
  },
);

await parser.parseAsync(hideBin(process.argv));
