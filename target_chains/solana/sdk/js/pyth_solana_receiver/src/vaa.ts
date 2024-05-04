import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { WormholeCoreBridgeSolana } from "./idl/wormhole_core_bridge_solana";
import { Program } from "@coral-xyz/anchor";
import { InstructionWithEphemeralSigners } from "@pythnetwork/solana-utils";
import { WRITE_ENCODED_VAA_COMPUTE_BUDGET } from "./compute_budget";
import { sha256 } from "@noble/hashes/sha256";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
/**
 * Get the index of the guardian set that signed a VAA
 */
export function getGuardianSetIndex(vaa: Buffer) {
  return vaa.readUInt32BE(1);
}

/**
 * The default number of signatures to keep in a VAA when using `trimSignatures`.
 * This number was chosen as the maximum number of signatures so that the VAA's contents can be posted in a single Solana transaction.
 */
export const DEFAULT_REDUCED_GUARDIAN_SET_SIZE = 5;

/**
 * The size of a guardian signature in a VAA.
 *
 * It is 66 bytes long, the first byte is the guardian index and the next 65 bytes are the signature (including a recovery id).
 */
export const VAA_SIGNATURE_SIZE = 66;

/**
 * Trim the number of signatures of a VAA.
 *
 * @returns the same VAA as the input, but with `n` signatures instead of the original number of signatures.
 *
 * A Wormhole VAA typically has a number of signatures equal to two thirds of the number of guardians. However,
 * this function is useful to make VAAs smaller to post their contents in a single Solana transaction.
 */
export function trimSignatures(
  vaa: Buffer,
  n = DEFAULT_REDUCED_GUARDIAN_SET_SIZE
): Buffer {
  const currentNumSignatures = vaa[5];
  if (n > currentNumSignatures) {
    throw new Error(
      "Resulting VAA can't have more signatures than the original VAA"
    );
  }

  const trimmedVaa = Buffer.concat([
    vaa.subarray(0, 6 + n * VAA_SIGNATURE_SIZE),
    vaa.subarray(6 + currentNumSignatures * VAA_SIGNATURE_SIZE),
  ]);

  trimmedVaa[5] = n;
  return trimmedVaa;
}

/**
 * The start of the VAA bytes in an encoded VAA account. Before this offset, the account contains a header.
 */
export const VAA_START = 46;

/**
 * Build an instruction to create an encoded VAA account.
 *
 * This is the first step to post a VAA to the Wormhole program.
 */
export async function buildEncodedVaaCreateInstruction(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
  encodedVaaKeypair: Keypair
): Promise<InstructionWithEphemeralSigners> {
  const encodedVaaSize = vaa.length + VAA_START;
  return {
    instruction: await wormhole.account.encodedVaa.createInstruction(
      encodedVaaKeypair,
      encodedVaaSize
    ),
    signers: [encodedVaaKeypair],
  };
}

/**
 * Writing the VAA to an encoded VAA account is done in 2 instructions.
 *
 * The first one writes the first `VAA_SPLIT_INDEX` bytes and the second one writes the rest.
 *
 * This number was chosen as the biggest number such that one can still call `createInstruction`, `initEncodedVaa` and `writeEncodedVaa` in a single Solana transaction.
 * This way, the packing of the instructions to post an encoded vaa is more efficient.
 */
export const VAA_SPLIT_INDEX = 755;

/**
 * Build a set of instructions to write a VAA to an encoded VAA account
 * This functions returns 2 instructions and splits the VAA in an opinionated way, so that the whole process of posting a VAA can be efficiently packed in the 2 transactions:
 *
 * TX 1 : `createInstruction` + `initEncodedVaa` + `writeEncodedVaa_1`
 *
 * TX 2 : `writeEncodedVaa_2` + `verifyEncodedVaaV1`
 */
export async function buildWriteEncodedVaaWithSplitInstructions(
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
      computeUnits: WRITE_ENCODED_VAA_COMPUTE_BUDGET,
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
      computeUnits: WRITE_ENCODED_VAA_COMPUTE_BUDGET,
    },
  ];
}

/**
 * Find all the encoded VAA accounts that have a given write authority
 * @returns a list of the public keys of the encoded VAA accounts
 */
export async function findEncodedVaaAccountsByWriteAuthority(
  connection: Connection,
  writeAuthority: PublicKey,
  wormholeProgramId: PublicKey
): Promise<PublicKey[]> {
  const result = await connection.getProgramAccounts(wormholeProgramId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(
            Buffer.from(sha256("account:EncodedVaa").slice(0, 8))
          ),
        },
      },
      {
        memcmp: {
          offset: 8 + 1,
          bytes: bs58.encode(writeAuthority.toBuffer()),
        },
      },
    ],
  });
  return result.map((account) => new PublicKey(account.pubkey));
}
