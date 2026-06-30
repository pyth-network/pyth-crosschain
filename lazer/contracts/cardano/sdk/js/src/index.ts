import type { UTxO } from "@evolution-sdk/evolution";
import {
  AssetName,
  Client,
  Data,
  DatumOption,
  mainnet,
  preprod,
  preview,
  Schema,
  TSchema,
} from "@evolution-sdk/evolution";
import type { ReadClient } from "@evolution-sdk/evolution/sdk/client/Client";

const PYTH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth State", "utf-8"));

/**
 * `aiken/interval` bound, mirroring the on-chain `IntervalBound` Plutus layout.
 * Trusted-signer expiry is stored as the upper bound of a validity range, so the
 * `Finite` variant carries the expiry instant (in milliseconds).
 */
const IntervalBoundType = TSchema.Union(
  TSchema.TaggedStruct("NegativeInfinity", {}, { flatInUnion: true }),
  TSchema.TaggedStruct(
    "Finite",
    { finite: TSchema.Integer },
    {
      flatInUnion: true,
    },
  ),
  TSchema.TaggedStruct("PositiveInfinity", {}, { flatInUnion: true }),
);

const IntervalBound = TSchema.Struct({
  bound_type: IntervalBoundType,
  is_inclusive: TSchema.Boolean,
});

const ValidityRange = TSchema.Struct({
  lower_bound: IntervalBound,
  upper_bound: IntervalBound,
});

// Schema matching the on-chain Pyth state datum layout. `trusted_signers` maps
// a 32-byte secp256k1 verification key to the validity range that bounds the
// signer's expiry (see `validators/pyth_state.ak`).
// biome-ignore assist/source/useSortedKeys: order-sensistive
const PythStateDatum = TSchema.Struct({
  // biome-ignore assist/source/useSortedKeys: order-sensitive
  governance: TSchema.Struct({
    wormhole: TSchema.ByteArray,
    emitter_chain: TSchema.Integer,
    emitter_address: TSchema.ByteArray,
    seen_sequence: TSchema.Integer,
  }),
  trusted_signers: TSchema.Map(TSchema.ByteArray, ValidityRange),
  deprecated_withdraw_scripts: TSchema.Map(
    TSchema.PlutusData,
    TSchema.PlutusData,
  ),
  withdraw_script: TSchema.ByteArray,
});

/** A trusted Lazer signer read from the on-chain Pyth state. */
export type TrustedSigner = {
  /** 32-byte secp256k1 verification key, hex-encoded without `0x`. */
  publicKey: string;
  /** Expiry timestamp in unix seconds. */
  expiresAt: bigint;
};

/** Cardano network the deployment lives on. */
export type CardanoNetwork = "mainnet" | "preprod" | "preview";

/**
 * Data provider used to read chain state. `koios` works without a token for
 * low-rate read access; `blockfrost` and `maestro` require a credential.
 */
export type CardanoProvider =
  | { type: "blockfrost"; projectId: string }
  | { type: "koios"; token?: string }
  | { type: "maestro"; apiKey: string };

const CHAINS = { mainnet, preprod, preview } as const;

/**
 * Build a read-only Evolution SDK client for the given network and provider.
 * The returned client is what {@link getPythState} expects.
 */
export function createReadClient(
  network: CardanoNetwork,
  provider: CardanoProvider,
): ReadClient {
  const assembly = Client.make(CHAINS[network]);
  switch (provider.type) {
    case "blockfrost": {
      return assembly.withBlockfrost({
        baseUrl: `https://cardano-${network}.blockfrost.io/api/v0`,
        projectId: provider.projectId,
      });
    }
    case "koios": {
      const subdomain = {
        mainnet: "api",
        preprod: "preprod",
        preview: "preview",
      }[network];
      return assembly.withKoios({
        baseUrl: `https://${subdomain}.koios.rest/api/v1`,
        ...(provider.token ? { token: provider.token } : {}),
      });
    }
    case "maestro": {
      return assembly.withMaestro({
        apiKey: provider.apiKey,
        baseUrl: `https://${network}.gomaestro-api.org/v1`,
      });
    }
  }
}

export async function getPythState(
  policyId: string,
  client: ReadClient,
): Promise<UTxO.UTxO> {
  const unit = policyId + AssetName.toHex(PYTH_STATE_NFT);
  return await client.getUtxoByUnit(unit);
}

function decodePythState(pythState: UTxO.UTxO) {
  if (!DatumOption.isInlineDatum(pythState.datumOption)) {
    throw new TypeError("State NFT UTxO does not have an inline datum");
  }

  const { data } = pythState.datumOption;
  if (!(data instanceof Data.Constr)) {
    throw new TypeError("State NFT datum is not a Constr");
  }

  return Schema.decodeSync(PythStateDatum)(data);
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
  return Buffer.from(decodePythState(pythState).withdraw_script).toString(
    "hex",
  );
}

/**
 * Returns the set of trusted Lazer signers stored in the on-chain Pyth state,
 * with each signer's expiry as a unix timestamp in seconds.
 *
 * On-chain the expiry is stored as the (millisecond) upper bound of an
 * `aiken/interval` validity range; this converts it back to seconds. Signers
 * without a finite upper bound (no expiry) are skipped — Lazer always sets a
 * finite expiry.
 *
 * @param pythState - fetched Pyth State UTxO
 */
export function getTrustedSigners(pythState: UTxO.UTxO): TrustedSigner[] {
  const { trusted_signers } = decodePythState(pythState);
  const signers: TrustedSigner[] = [];
  for (const [key, validity] of trusted_signers) {
    const upperBound = validity.upper_bound.bound_type;
    if (upperBound._tag !== "Finite") {
      continue;
    }
    signers.push({
      expiresAt: upperBound.finite / 1000n,
      publicKey: Buffer.from(key).toString("hex"),
    });
  }
  return signers;
}

export type { ReadClient } from "@evolution-sdk/evolution/sdk/client/Client";

/** Re-export of the Evolution SDK UTxO type wrapping the Pyth state. */
export type CardanoUTxO = UTxO.UTxO;
