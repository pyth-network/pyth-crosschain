import { ParsedVaa } from "@certusone/wormhole-sdk";
import { GuardianSet } from "@certusone/wormhole-spydk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { ethers } from "ethers";

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

  const digest = ethers.utils.keccak256(vaa.hash);

  let validVaa = true;
  vaa.guardianSignatures.forEach((sig) => {
    if (
      ethers.utils.recoverAddress(digest, sig.signature) !==
      currentGuardianSet.addresses[sig.index]
    )
      validVaa = false;
  });

  return validVaa;
}
