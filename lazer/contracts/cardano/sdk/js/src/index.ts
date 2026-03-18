import type { UTxO } from "@evolution-sdk/evolution";
import {
  AssetName,
  createClient,
  Data,
  DatumOption,
  Schema,
  TSchema,
} from "@evolution-sdk/evolution";
import type {
  NetworkId,
  ProviderOnlyClient,
} from "@evolution-sdk/evolution/sdk/client/Client";

/**
 * Cardano network identifier.
 */
export type Network = Exclude<NetworkId, number>;

/**
 * Provider configuration for connecting to a Cardano node.
 */
export type Provider =
  | {
      type: "koios";
      token?: string;
    }
  | {
      type: "blockfrost";
      projectId: string;
    }
  | {
      type: "maestro";
      apiKey: string;
    };

/**
 * Create Cardano client using Evolution SDK.
 * @param network public network to use
 * @param provider API provider and token
 * @returns
 */
export function createEvolutionClient(
  network: Network,
  provider: Provider,
): ProviderOnlyClient {
  return createClient({
    network,
    provider: { ...provider, baseUrl: resolveBaseUrl(network, provider) },
  });
}

function resolveBaseUrl(network: Network, provider: Provider): string {
  switch (provider.type) {
    case "blockfrost": {
      return `https://cardano-${network}.blockfrost.io/api/v0`;
    }
    case "koios": {
      return `https://${
        {
          mainnet: "api",
          preprod: "preprod",
          preview: "preview",
        }[network]
      }.koios.rest/api/v1`;
    }
    case "maestro": {
      return `https://${network}.gomaestro-api.org/v1`;
    }
  }
}

const PYTH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth State", "utf-8"));

// Minimal schema matching the on-chain Pyth state datum layout.
// Only the `withdraw_script` field is used; the preceding fields
// are defined to keep positional alignment with the Plutus struct.
// biome-ignore assist/source/useSortedKeys: order-sensistive
const PythStateDatum = TSchema.Struct({
  // biome-ignore assist/source/useSortedKeys: order-sensitive
  governance: TSchema.Struct({
    wormhole: TSchema.ByteArray,
    emitter_chain: TSchema.Integer,
    emitter_address: TSchema.ByteArray,
    seen_sequence: TSchema.Integer,
  }),
  trusted_signers: TSchema.Map(TSchema.PlutusData, TSchema.PlutusData),
  deprecated_withdraw_scripts: TSchema.Map(
    TSchema.PlutusData,
    TSchema.PlutusData,
  ),
  withdraw_script: TSchema.ByteArray,
});

export async function getPythState(
  policyId: string,
  client: ProviderOnlyClient,
): Promise<UTxO.UTxO> {
  const unit = policyId + AssetName.toHex(PYTH_STATE_NFT);
  return await client.getUtxoByUnit(unit);
}

/**
 * Returns the hex-encoded hash of the withdraw script currently stored in the
 * on-chain Pyth state for the given deployment.
 *
 * The withdraw script hash is read from the inline datum attached to the
 * State NFT UTxO identified by `policyId`.
 *
 * @param pythState - fetched Pyth State UTxO
 * @returns The withdraw script hash as a hex string.
 */
export function getPythScriptHash(pythState: UTxO.UTxO): string {
  if (!DatumOption.isInlineDatum(pythState.datumOption)) {
    throw new TypeError("State NFT UTxO does not have an inline datum");
  }

  const { data } = pythState.datumOption;
  if (!(data instanceof Data.Constr)) {
    throw new TypeError("State NFT datum is not a Constr");
  }

  const state = Schema.decodeSync(PythStateDatum)(data);
  return Buffer.from(state.withdraw_script).toString("hex");
}
