import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  decodeGovernancePayload,
  UpdateTrustedSigner256Bit,
  UpgradeCardanoSpendScript,
  UpgradeCardanoWithdrawScript,
} from "@pythnetwork/xc-admin-common";
import type { VAA } from "@wormhole-foundation/sdk-definitions";
import * as wormhole from "@wormhole-foundation/sdk-definitions";

const GUARDIAN_SET_VAAS_URL =
  "https://raw.githubusercontent.com/wormhole-foundation/wormhole/refs/heads/main/deployments/mainnet/guardianSetVAAs.csv";

export type PreparedVAA = {
  vaa: Uint8Array;
  recovered_keys: Uint8Array[];
};

export type PreparedGovernanceAction = {
  vaa: PreparedVAA;
  action:
    | UpdateTrustedSigner256Bit
    | UpgradeCardanoSpendScript
    | UpgradeCardanoWithdrawScript;
};

export function prepareGovernanceAction(
  vaa: Uint8Array,
): PreparedGovernanceAction {
  const parsed = wormhole.deserialize("Uint8Array", vaa);
  const keys = recoverVaaPublicKeys(parsed);
  const action = decodeGovernancePayload(Buffer.from(parsed.payload));
  if (!action) {
    throw new Error("Could not decode governance action");
  }
  if (
    !(
      action instanceof UpdateTrustedSigner256Bit ||
      action instanceof UpgradeCardanoSpendScript ||
      action instanceof UpgradeCardanoWithdrawScript
    )
  ) {
    throw new TypeError("Not a valid Cardano governance action");
  }
  return {
    action,
    vaa: {
      recovered_keys: keys.map(({ key }) => key),
      vaa,
    },
  };
}

export type PreparedGuardianSetUpgrade = {
  vaa: PreparedVAA;
  seen_sequence: bigint;
  index: number;
  set: readonly string[];
};

export async function prepareGuardianSetVAAs(): Promise<
  PreparedGuardianSetUpgrade[]
> {
  const vaas = await fetchGuardianSetVAAs();
  return vaas.map(({ index, vaa }) => {
    const bytes = Buffer.from(vaa, "hex");
    const parsed = parseGuardianSetUpgrade(bytes);
    const keys = recoverVaaPublicKeys(parsed);
    return {
      index,
      seen_sequence: parsed.sequence,
      set: parsed.payload.actionArgs.guardians,
      vaa: {
        recovered_keys: keys.map(({ key }) => key),
        vaa: bytes,
      },
    };
  });
}

async function fetchGuardianSetVAAs() {
  const res = await fetch(GUARDIAN_SET_VAAS_URL);
  if (!res.ok) {
    throw new Error(
      `Guardian set VAAs fetch error: ${res.status} ${res.statusText}`,
    );
  }

  const csv = await res.text();
  return csv
    .trim()
    .split("\n")
    .map((line) => {
      const [index = "", vaa = ""] = line.trim().split(",");
      return {
        index: Number.parseInt(index.replace(/^gs/, "")),
        vaa,
      };
    });
}

const parseGuardianSetUpgrade = (
  vaa: Uint8Array,
): VAA<"WormholeCore:GuardianSetUpgrade"> =>
  wormhole.deserialize("WormholeCore:GuardianSetUpgrade", vaa);

const recoverVaaPublicKeys = (vaa: VAA) =>
  vaa.signatures.map(({ guardianIndex: index, signature: { r, s, v } }) => {
    const key = new secp256k1.Signature(r, s, v)
      // Provided `VAA.hash` only has keccak256 applied once
      .recoverPublicKey(wormhole.keccak256(vaa.hash))
      .toBytes(false);
    return {
      // Ethereum-style address for comparison with on-chain computation
      address: wormhole.keccak256(key.slice(1)).slice(12),
      index,
      key,
    };
  });
