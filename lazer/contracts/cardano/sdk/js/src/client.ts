import type { Time } from "@evolution-sdk/evolution";
import {
  AssetName,
  Assets,
  createClient,
  DatumOption,
  Effect,
  Either,
  UTxO,
} from "@evolution-sdk/evolution";
import { Address } from "@evolution-sdk/evolution/Address";
import type { Data } from "@evolution-sdk/evolution/Data";
import type { KeyHash } from "@evolution-sdk/evolution/KeyHash";
import type { Script } from "@evolution-sdk/evolution/Script";
import type { ScriptHash } from "@evolution-sdk/evolution/ScriptHash";
import type { PayToAddressParams } from "@evolution-sdk/evolution/sdk/builders/operations/Operations";
import type { SigningTransactionBuilder } from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import { calculateMinimumUtxoLovelace } from "@evolution-sdk/evolution/sdk/builders/TxBuilderImpl";
import type {
  NetworkId,
  SigningClient,
} from "@evolution-sdk/evolution/sdk/client/Client";
import type { ProtocolParameters } from "@evolution-sdk/evolution/sdk/provider/Provider";
import type { TransactionHash } from "@evolution-sdk/evolution/TransactionHash";

export type Network = Exclude<NetworkId, number> | "devnet";

const DEVNET_PROVIDER = {
  kupoUrl: "http://localhost:1442",
  ogmiosUrl: "http://localhost:1337",
  type: "kupmios",
} as const;

export type Payment = {
  address: Address;
  assets: Assets.Assets;
  datum?: DatumOption.DatumOption;
  script?: Script;
};

export class ClientContext {
  private usedUtxos: UTxO.UTxOSet = UTxO.empty();

  private constructor(
    readonly network: Network,
    readonly client: SigningClient,
    readonly parameters: ProtocolParameters,
    readonly debug: boolean,
  ) {}

  static async create(
    network: Network,
    mnemonic: string,
    token = "",
    options: { debug?: boolean } = {},
  ): Promise<ClientContext> {
    if (network === "devnet") {
      const client = createClient({
        network: 0,
        provider: DEVNET_PROVIDER,
        slotConfig: await getDevnetSlotConfig(),
        wallet: {
          accountIndex: 0,
          mnemonic,
          type: "seed",
        },
      });
      return new ClientContext(
        "devnet",
        client,
        await client.getProtocolParameters(),
        options.debug ?? false,
      );
    } else {
      const client = createClient({
        network,
        provider: {
          // TODO:
          // baseUrl: `https://${
          //   {
          //     mainnet: "api",
          //     preprod: "preprod",
          //     preview: "preview",
          //   }[network]
          // }.koios.rest/api/v1`,
          // token,
          // type: "koios",
          baseUrl: "https://cardano-preview.blockfrost.io/api/v0",
          projectId: token,
          type: "blockfrost",
        },
        wallet: {
          accountIndex: 0,
          mnemonic,
          type: "seed",
        },
      });
      return new ClientContext(
        network,
        client,
        await client.getProtocolParameters(),
        options.debug ?? false,
      );
    }
  }

  async run(tx: SigningTransactionBuilder): Promise<TransactionHash> {
    const digest = await Either.getOrThrowWith(
      await tx.buildEither({ debug: this.debug }),
      (e) => JSON.stringify(e, undefined, 2),
    ).signAndSubmit();
    await this.client.awaitTx(digest);
    return digest;
  }

  calculateFee({ script, ...args }: Payment): bigint {
    return Effect.runSync(
      calculateMinimumUtxoLovelace({
        ...args,
        coinsPerUtxoByte: this.parameters.coinsPerUtxoByte,
        ...(script ? { scriptRef: script } : {}),
      }),
    );
  }

  assetsWithFee(payment: Payment): Assets.Assets {
    return Assets.addLovelace(payment.assets, this.calculateFee(payment));
  }

  newAddress(paymentCredential: KeyHash | ScriptHash): Address {
    return new Address({
      networkId: this.network === "mainnet" ? 1 : 0,
      paymentCredential,
    });
  }

  /**
   * Gets fresh UTxO, tracking locally used ones to avoid attempts to
   * double-spend.
   */
  async getFreshUtxo() {
    const utxos = await this.client.getWalletUtxos();
    // Blockfrost provider was returning spent UTxOs
    const fresh = utxos.find((u) => !UTxO.has(this.usedUtxos, u));
    if (!fresh) {
      throw new Error(`Could not find a valid UTxO (from ${utxos.length})`);
    }
    this.usedUtxos = UTxO.add(this.usedUtxos, fresh);
    return fresh;
  }

  async payToMe(assets: Assets.Assets): Promise<PayToAddressParams> {
    const address = await this.client.address();
    const payment = { address, assets };
    payment.assets = this.assetsWithFee(payment);
    return payment;
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

async function getDevnetSlotConfig(): Promise<Time.SlotConfig> {
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
  createClient({
    network: 0,
    provider: DEVNET_PROVIDER,
    wallet: { accountIndex: 0, mnemonic, type: "seed" },
  });
