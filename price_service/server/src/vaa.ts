import { logger } from "./logging";
import { ParsedVaa } from "@certusone/wormhole-sdk";
import { GuardianSet } from "@certusone/wormhole-spydk/lib/cjs/proto/publicrpc/v1/publicrpc";
import * as secp256k1 from "secp256k1";
import * as keccak from "keccak";

const WormholeClusters = ["localnet", "testnet", "mainnet"] as const;
export type WormholeCluster = typeof WormholeClusters[number];

export function wormholeClusterFromString(s: string): WormholeCluster {
  if (WormholeClusters.includes(s as WormholeCluster)) {
    return s as WormholeCluster;
  }
  throw new Error(`Invalid wormhole cluster: ${s}`);
}

const guardianSets: Record<WormholeCluster, GuardianSet> = {
  localnet: {
    index: 0,
    addresses: ["0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"],
  },
  testnet: {
    index: 0,
    addresses: ["0x13947Bd48b18E53fdAeEe77F3473391aC727C638"],
  },
  mainnet: {
    index: 3,
    addresses: [
      "0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5",
      "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157",
      "0x114De8460193bdf3A2fCf81f86a09765F4762fD1",
      "0x107A0086b32d7A0977926A205131d8731D39cbEB",
      "0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2",
      "0x11b39756C042441BE6D8650b69b54EbE715E2343",
      "0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd",
      "0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20",
      "0x74a3bf913953D695260D88BC1aA25A4eeE363ef0",
      "0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e",
      "0xAF45Ced136b9D9e24903464AE889F5C8a723FC14",
      "0xf93124b7c738843CBB89E864c862c38cddCccF95",
      "0xD2CC37A4dc036a8D232b48f62cDD4731412f4890",
      "0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811",
      "0x71AA1BE1D36CaFE3867910F99C09e347899C19C3",
      "0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf",
      "0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8",
      "0x5E1487F35515d02A92753504a8D75471b9f49EdB",
      "0x6FbEBc898F403E4773E95feB15E80C9A99c8348d",
    ],
  },
};

export function isValidVaa(vaa: ParsedVaa, cluster: WormholeCluster): boolean {
  const currentGuardianSet = guardianSets[cluster];
  if (vaa.guardianSetIndex !== currentGuardianSet.index) {
    return false;
  }

  const threshold = Math.ceil((currentGuardianSet.addresses.length * 2) / 3);
  if (vaa.guardianSignatures.length < threshold) {
    return false;
  }

  // It's not possible to call a signature verification function directly
  // because we only have the addresses of the guardians and not their public
  // keys. Instead, we compare the address extracted from the public key that
  // signed the VAA with the corresponding address stored in the guardian set.

  const messageHash = keccak.default("keccak256").update(vaa.hash).digest();
  let counter = 0;

  try {
    vaa.guardianSignatures.forEach((sig) => {
      // Each signature is a 65-byte secp256k1 signature with the recovery ID at
      // the last byte. It is not the compact representation from EIP-2098.
      const recoveryID = sig.signature[64] % 2;
      const signature = sig.signature.slice(0, 64);
      const publicKey = Buffer.from(
        secp256k1.ecdsaRecover(signature, recoveryID, messageHash, false)
      );
      // The first byte of the public key is the prefix (0x03 or 0x04)
      // indicating if the public key is compressed. Remove it before hashing.
      const publicKeyHash = keccak
        .default("keccak256")
        .update(publicKey.slice(1))
        .digest();
      // The last 20 bytes of the hash are the address.
      const address = publicKeyHash.slice(-20).toString("hex");

      if (
        checksumAddress(address) === currentGuardianSet.addresses[sig.index]
      ) {
        counter++;
      }
    });

    return counter === vaa.guardianSignatures.length;
  } catch (error) {
    logger.warn("Error validating VAA signatures:", error);

    return false;
  }
}

function checksumAddress(address: string) {
  address = address.toLowerCase().replace("0x", "");
  const hash = keccak.default("keccak256").update(address).digest("hex");
  let ret = "0x";

  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase();
    } else {
      ret += address[i];
    }
  }

  return ret;
}
