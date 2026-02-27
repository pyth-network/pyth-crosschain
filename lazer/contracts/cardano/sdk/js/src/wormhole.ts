import { secp256k1 } from "@noble/curves/secp256k1.js";
import type { VAA } from "@wormhole-foundation/sdk-definitions";
import * as wormhole from "@wormhole-foundation/sdk-definitions";

const GUARDIAN_SET_VAAS_URL =
  "https://raw.githubusercontent.com/wormhole-foundation/wormhole/refs/heads/main/deployments/mainnet/guardianSetVAAs.csv";

export type PreparedVAA = {
  vaa: Uint8Array;
  recovered_keys: Uint8Array[];
};

export type PreparedGuardianSetUpgrade = {
  vaa: PreparedVAA;
  index: number;
  guardians: readonly string[];
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
      guardians: parsed.payload.actionArgs.guardians,
      index,
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
