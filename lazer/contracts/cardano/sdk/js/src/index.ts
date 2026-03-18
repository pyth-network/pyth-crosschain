import {
  AssetName,
  createClient,
  Data,
  DatumOption,
  Schema,
  TSchema,
} from "@evolution-sdk/evolution";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";

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

const PYTH_STATE_NFT = AssetName.fromBytes(
  Buffer.from("Pyth State", "utf-8"),
);

// Minimal schema matching the on-chain Pyth state datum layout.
// Only the `withdraw_script` field is used; the preceding fields
// are defined to keep positional alignment with the Plutus struct.
const PythStateDatum = TSchema.Struct({
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

function resolveBaseUrl(
  network: Network,
  provider: Provider,
): string {
  switch (provider.type) {
    case "blockfrost": {
      return `https://cardano-${network}.blockfrost.io/api/v0`;
    }
    case "koios": {
      return `https://${{
        mainnet: "api",
        preprod: "preprod",
        preview: "preview",
      }[network]}.koios.rest/api/v1`;
    }
    case "maestro": {
      return `https://${network}.gomaestro-api.org/v1`;
    }
  }
}

/**
 * Returns the hex-encoded hash of the withdraw script currently stored in the
 * on-chain Pyth state for the given deployment.
 *
 * The withdraw script hash is read from the inline datum attached to the
 * State NFT UTxO identified by `policyId`.
 *
 * @param policyId - Hex-encoded policy ID of the Pyth deployment.
 * @param network  - Cardano network to query (e.g. `"preprod"`).
 * @param provider - Provider configuration for the Cardano node.
 * @returns The withdraw script hash as a hex string.
 */
export async function getWithdrawScriptHash(
  policyId: string,
  network: Network,
  provider: Provider,
): Promise<string> {
  const baseUrl = resolveBaseUrl(network, provider);
  const client = createClient({
    network,
    provider: { baseUrl, ...provider },
  });

  const unit = policyId + AssetName.toHex(PYTH_STATE_NFT);
  const utxo = await client.getUtxoByUnit(unit);

  if (!DatumOption.isInlineDatum(utxo.datumOption)) {
    throw new TypeError("State NFT UTxO does not have an inline datum");
  }

  const datum = utxo.datumOption.data;
  if (!(datum instanceof Data.Constr)) {
    throw new TypeError("State NFT datum is not a Constr");
  }

  const state = Schema.decodeSync(PythStateDatum)(datum);
  return Buffer.from(state.withdraw_script).toString("hex");
}
