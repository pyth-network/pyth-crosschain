import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { WormholeCoreBridgeSolana } from "./idl/wormhole_core_bridge_solana";
import { Program } from "@coral-xyz/anchor";
import { InstructionWithEphemeralSigners } from "@pythnetwork/solana-utils";

export const VAA_START = 46;
export const VAA_SIGNATURE_SIZE = 66;
export const VAA_SPLIT_INDEX = 792;

export function getGuardianSetIndex(vaa: Buffer) {
  return vaa.readUInt32BE(1);
}

export function trimSignatures(vaa: Buffer, n: number): Buffer {
  const currentNumSignatures = vaa[5];
  if (n > currentNumSignatures) {
    throw new Error(
      "Resulting VAA can't have more signatures than the original VAA"
    );
  }

  let trimmedVaa = Buffer.concat([
    vaa.subarray(0, 6 + n * VAA_SIGNATURE_SIZE),
    vaa.subarray(6 + currentNumSignatures * VAA_SIGNATURE_SIZE),
  ]);

  trimmedVaa[5] = n;
  return trimmedVaa;
}

export async function buildEncodedVaaCreateInstruction(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
  encodedVaaKeypair: Keypair
) {
  const encodedVaaSize = vaa.length + VAA_START;
  return {
    instruction: await wormhole.account.encodedVaa.createInstruction(
      encodedVaaKeypair,
      encodedVaaSize
    ),
    signers: [encodedVaaKeypair],
  };
}

export async function buildWriteEncodedVaaWithSplit(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
  draftVaa: PublicKey
): Promise<InstructionWithEphemeralSigners[]> {
  return [
    {
      instruction: await wormhole.methods
        .writeEncodedVaa({
          index: 0,
          data: vaa.subarray(0, VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa,
        })
        .instruction(),
      signers: [],
    },
    {
      instruction: await wormhole.methods
        .writeEncodedVaa({
          index: VAA_SPLIT_INDEX,
          data: vaa.subarray(VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa,
        })
        .instruction(),
      signers: [],
    },
  ];
}
