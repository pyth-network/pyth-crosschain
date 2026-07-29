/** biome-ignore-all lint/suspicious/noConsole: utilities used in CLI */
import type { Assets, UTxO } from "@evolution-sdk/evolution";
import {
  AssetName,
  Client,
  DatumOption,
  Effect,
  TransactionHash,
} from "@evolution-sdk/evolution";
import { Address } from "@evolution-sdk/evolution/Address";
import type { Data } from "@evolution-sdk/evolution/Data";
import type { KeyHash } from "@evolution-sdk/evolution/KeyHash";
import type { ScriptHash } from "@evolution-sdk/evolution/ScriptHash";
import type { SlotConfig } from "@evolution-sdk/evolution/SlotConfig";
import type { PayToAddressParams } from "@evolution-sdk/evolution/sdk/builders/operations/Operations";
import type { SigningTransactionBuilder } from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import * as Chain from "@evolution-sdk/evolution/sdk/client/Chain";
import type {
  KupmiosConfig,
  SigningClient,
} from "@evolution-sdk/evolution/sdk/client/Client";
import { Schedule } from "effect";

export type Network = "mainnet" | "preprod" | "preview" | "devnet";

const DEVNET_PROVIDER: KupmiosConfig = {
  kupoUrl: "http://localhost:1442",
  ogmiosUrl: "http://localhost:1337",
};

export type Provider =
  | {
      type: "koios";
      token: string;
    }
  | {
      type: "blockfrost";
      projectId: string;
    }
  | {
      type: "maestro";
      apiKey: string;
    };

export class ClientContext {
  private constructor(
    readonly network: Network,
    readonly client: SigningClient,
    readonly debug: boolean,
  ) {}

  static async create(
    network: Network,
    provider: Provider,
    mnemonic: string,
    options: { debug?: boolean } = {},
  ): Promise<ClientContext> {
    const debug = options.debug ?? false;
    const wallet = { accountIndex: 0, mnemonic };

    if (network === "devnet") {
      const chain = {
        ...Chain.preview,
        name: "Cardano Devnet",
        slotConfig: await getDevnetSlotConfig(),
      };
      const client = Client.make(chain)
        .withKupmios(DEVNET_PROVIDER)
        .withSeed(wallet);
      return new ClientContext("devnet", client, debug);
    }

    let baseUrl: string;
    switch (provider.type) {
      case "blockfrost": {
        baseUrl = `https://cardano-${network}.blockfrost.io/api/v0`;
        break;
      }
      case "koios": {
        baseUrl = `https://${
          network === "mainnet" ? "api" : network
        }.koios.rest/api/v1`;
        break;
      }
      case "maestro": {
        baseUrl = `https://${network}.gomaestro-api.org/v1`;
        break;
      }
    }

    const chain = Chain[network];
    let client: SigningClient;
    switch (provider.type) {
      case "blockfrost":
        client = Client.make(chain)
          .withBlockfrost({ baseUrl, projectId: provider.projectId })
          .withSeed(wallet);
        break;
      case "koios":
        client = Client.make(chain)
          .withKoios({ baseUrl, token: provider.token })
          .withSeed(wallet);
        break;
      case "maestro":
        client = Client.make(chain)
          .withMaestro({ baseUrl, apiKey: provider.apiKey })
          .withSeed(wallet);
        break;
    }
    return new ClientContext(network, client, debug);
  }

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  async run<const R extends any[]>(
    build: () => Promise<[SigningTransactionBuilder, ...R]>,
  ): Promise<readonly [TransactionHash.TransactionHash, ...R]> {
    return await Effect.runPromise(this.runEffect(build));
  }

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  runEffect<const R extends any[]>(
    build: () => Promise<[SigningTransactionBuilder, ...R]>,
  ): Effect.Effect<readonly [TransactionHash.TransactionHash, ...R], Error> {
    const { client, debug } = this;
    const times = 2;

    let attempt = 1;
    return Effect.gen(function* () {
      console.info(`(Attempt #${attempt++} out of ${times + 1}...)`);
      const [tx, ...res] = yield* Effect.tryPromise(() => build());
      const built = yield* Effect.catchAllDefect((e) =>
        // .buildEffect `throw`s internally, we need to handle that
        Effect.fail(e as Error),
      )(tx.buildEffect({ autoMinUtxo: true, debug }));
      const digest = yield* built.effect.signAndSubmit();
      if (debug) console.debug(`digest ${TransactionHash.toHex(digest)}...`);
      yield* client.effect.awaitTx(digest);
      if (debug) console.debug(`...confirmed`);
      return [digest, ...res] as const;
    }).pipe(
      Effect.retry({ schedule: Schedule.spaced("5 seconds"), times }),
    ) as Effect.Effect<
      readonly [TransactionHash.TransactionHash, ...R],
      Error
    >;
  }

  newAddress(paymentCredential: KeyHash | ScriptHash): Address {
    return new Address({
      networkId: this.network === "mainnet" ? 1 : 0,
      paymentCredential,
    });
  }

  async getFreshUtxo() {
    const [utxo] = await this.client.getWalletUtxos();
    if (!utxo) {
      throw new Error("Could not find a valid UTxO");
    }
    return utxo;
  }

  async payToMe(assets: Assets.Assets): Promise<PayToAddressParams> {
    const address = await this.client.address();
    return { address, assets };
  }

  async getNftUtxo(
    policy: string,
    name: AssetName.AssetName,
  ): Promise<UTxO.UTxO> {
    return await this.client.getUtxoByUnit(policy + AssetName.toHex(name));
  }

  static readUtxo({ datumOption }: UTxO.UTxO): Data {
    if (!DatumOption.isInlineDatum(datumOption)) {
      throw new TypeError("UTxO does not have inline datum");
    }
    return datumOption.data;
  }
}

async function getDevnetSlotConfig(): Promise<SlotConfig> {
  const healthRes = await fetch("http://localhost:1337/health");
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

export const getOfflineDevnetClient = (mnemonic: string): SigningClient =>
  Client.make({ ...Chain.preview, name: "Cardano Devnet" })
    .withKupmios(DEVNET_PROVIDER)
    .withSeed({ accountIndex: 0, mnemonic });
