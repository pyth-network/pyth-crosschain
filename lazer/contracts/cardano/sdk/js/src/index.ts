import type { UTxO } from "@evolution-sdk/evolution";
import {
  AssetName,
  Data,
  DatumOption,
  Schema,
  TSchema,
} from "@evolution-sdk/evolution";
import type { ProviderOnlyClient } from "@evolution-sdk/evolution/sdk/client/Client";

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
