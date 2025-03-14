import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { WormholeCoreBridgeSolana } from "./idl/wormhole_core_bridge_solana";
import { Program } from "@coral-xyz/anchor";
import { InstructionWithEphemeralSigners } from "@pythnetwork/solana-utils";
import {
  CLOSE_ENCODED_VAA_COMPUTE_BUDGET,
  INIT_ENCODED_VAA_COMPUTE_BUDGET,
  VERIFY_ENCODED_VAA_COMPUTE_BUDGET,
  WRITE_ENCODED_VAA_COMPUTE_BUDGET,
} from "./compute_budget";
import { sha256 } from "@noble/hashes/sha256";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { AccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { getGuardianSetPda } from "./address";
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
 * The start of the VAA bytes in an encoded VAA account. Before this offset, the account contains a header.
 */
export const VAA_START = 46;

/**
 * Writing the VAA to an encoded VAA account is done in 2 instructions.
 *
 * The first one writes the first `VAA_SPLIT_INDEX` bytes and the second one writes the rest.
 *
 * This number was chosen as the biggest number such that one can still call `createInstruction`,
 * `initEncodedVaa` and `writeEncodedVaa` in a single Solana transaction, while using an address lookup table.
 * This way, the packing of the instructions to post an encoded vaa is more efficient.
 */
export const VAA_SPLIT_INDEX = 721;

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
  n = DEFAULT_REDUCED_GUARDIAN_SET_SIZE,
): Buffer {
  const currentNumSignatures = vaa[5];
  if (n > currentNumSignatures) {
    throw new Error(
      "Resulting VAA can't have more signatures than the original VAA",
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
 * Groups of instructions for posting a VAA to the Wormhole program.
 * The instructions are split into logical groups to allow flexible ordering and batching:
 * - initInstructions: Create and initialize the encoded VAA account
 * - writeFirstPartInstructions: Write the first part of the VAA data (up to VAA_SPLIT_INDEX)
 * - writeSecondPartAndVerifyInstructions: Write remaining VAA data and verify signatures
 * - closeInstructions: Close the encoded VAA account to recover rent
 */
interface VaaInstructionGroups {
  initInstructions: InstructionWithEphemeralSigners[];
  writeFirstPartInstructions: InstructionWithEphemeralSigners[];
  writeSecondPartAndVerifyInstructions: InstructionWithEphemeralSigners[];
  closeInstructions: InstructionWithEphemeralSigners[];
  encodedVaaAddress: PublicKey;
}

// Core function to generate VAA instruction groups
async function generateVaaInstructionGroups(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
): Promise<VaaInstructionGroups> {
  const encodedVaaKeypair = new Keypair();

  // Create and init instructions
  const initInstructions: InstructionWithEphemeralSigners[] = [
    await buildEncodedVaaCreateInstruction(wormhole, vaa, encodedVaaKeypair),
    {
      instruction: await wormhole.methods
        .initEncodedVaa()
        .accounts({
          encodedVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
      computeUnits: INIT_ENCODED_VAA_COMPUTE_BUDGET,
    },
  ];

  // First write instruction
  const writeFirstPartInstructions: InstructionWithEphemeralSigners[] = [
    {
      instruction: await wormhole.methods
        .writeEncodedVaa({
          index: 0,
          data: vaa.subarray(0, VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
      computeUnits: WRITE_ENCODED_VAA_COMPUTE_BUDGET,
    },
  ];

  // Second write and verify instructions
  const writeSecondPartAndVerifyInstructions: InstructionWithEphemeralSigners[] =
    [
      {
        instruction: await wormhole.methods
          .writeEncodedVaa({
            index: VAA_SPLIT_INDEX,
            data: vaa.subarray(VAA_SPLIT_INDEX),
          })
          .accounts({
            draftVaa: encodedVaaKeypair.publicKey,
          })
          .instruction(),
        signers: [],
        computeUnits: WRITE_ENCODED_VAA_COMPUTE_BUDGET,
      },
      {
        instruction: await wormhole.methods
          .verifyEncodedVaaV1()
          .accounts({
            guardianSet: getGuardianSetPda(
              getGuardianSetIndex(vaa),
              wormhole.programId,
            ),
            draftVaa: encodedVaaKeypair.publicKey,
          })
          .instruction(),
        signers: [],
        computeUnits: VERIFY_ENCODED_VAA_COMPUTE_BUDGET,
      },
    ];

  // Close instructions
  const closeInstructions: InstructionWithEphemeralSigners[] = [
    {
      instruction: await wormhole.methods
        .closeEncodedVaa()
        .accounts({ encodedVaa: encodedVaaKeypair.publicKey })
        .instruction(),
      signers: [],
      computeUnits: CLOSE_ENCODED_VAA_COMPUTE_BUDGET,
    },
  ];

  return {
    initInstructions,
    writeFirstPartInstructions,
    writeSecondPartAndVerifyInstructions,
    closeInstructions,
    encodedVaaAddress: encodedVaaKeypair.publicKey,
  };
}

/**
 * Build instructions to post a single VAA to the Wormhole program.
 * The instructions can be packed efficiently into 2 transactions:
 * - TX1: Create, init the encoded VAA account and write the first part of the VAA
 * - TX2: Write the second part of the VAA and verify it
 *
 * @param wormhole - The Wormhole program instance
 * @param vaa - The VAA buffer to post
 * @returns {Object} Result containing:
 *   - encodedVaaAddress: Public key of the encoded VAA account
 *   - postInstructions: Instructions to post and verify the VAA
 *   - closeInstructions: Instructions to close the encoded VAA account and recover rent
 */
export async function buildPostEncodedVaaInstructions(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
): Promise<{
  encodedVaaAddress: PublicKey;
  postInstructions: InstructionWithEphemeralSigners[];
  closeInstructions: InstructionWithEphemeralSigners[];
}> {
  const groups = await generateVaaInstructionGroups(wormhole, vaa);

  // Pack instructions for optimal 2-transaction pattern:
  // TX1: init + first write
  // TX2: second write + verify
  return {
    encodedVaaAddress: groups.encodedVaaAddress,
    postInstructions: [
      ...groups.initInstructions,
      ...groups.writeFirstPartInstructions,
      ...groups.writeSecondPartAndVerifyInstructions,
    ],
    closeInstructions: groups.closeInstructions,
  };
}

/**
 * Build instructions to post two VAAs for TWAP (Time-Weighted Average Price) calculations,
 * optimized for 3 transactions. This is specifically designed for posting start and end
 * accumulator update VAAs efficiently.
 * The instructions are packed into 3 transactions:
 * - TX1: Initialize and write first part of start VAA
 * - TX2: Initialize and write first part of end VAA
 * - TX3: Write second part and verify both VAAs
 *
 * @param wormhole - The Wormhole program instance
 * @param startUpdateData - Accumulator update data containing the start VAA
 * @param endUpdateData - Accumulator update data containing the end VAA
 * @returns {Object} Result containing:
 *   - startEncodedVaaAddress: Public key of the start VAA account
 *   - endEncodedVaaAddress: Public key of the end VAA account
 *   - postInstructions: Instructions to post and verify both VAAs
 *   - closeInstructions: Instructions to close both encoded VAA accounts
 */
export async function buildPostEncodedVaasForTwapInstructions(
  wormhole: Program<WormholeCoreBridgeSolana>,
  startUpdateData: AccumulatorUpdateData,
  endUpdateData: AccumulatorUpdateData,
): Promise<{
  startEncodedVaaAddress: PublicKey;
  endEncodedVaaAddress: PublicKey;
  postInstructions: InstructionWithEphemeralSigners[];
  closeInstructions: InstructionWithEphemeralSigners[];
}> {
  const startGroups = await generateVaaInstructionGroups(
    wormhole,
    startUpdateData.vaa,
  );
  const endGroups = await generateVaaInstructionGroups(
    wormhole,
    endUpdateData.vaa,
  );

  // Pack instructions for optimal 3-transaction pattern:
  // TX1: start VAA init + first write
  // TX2: end VAA init + first write
  // TX3: both VAAs second write + verify
  const postInstructions = [
    // TX1
    ...startGroups.initInstructions,
    ...startGroups.writeFirstPartInstructions,
    // TX2
    ...endGroups.initInstructions,
    ...endGroups.writeFirstPartInstructions,
    // TX3
    ...startGroups.writeSecondPartAndVerifyInstructions,
    ...endGroups.writeSecondPartAndVerifyInstructions,
  ];

  return {
    startEncodedVaaAddress: startGroups.encodedVaaAddress,
    endEncodedVaaAddress: endGroups.encodedVaaAddress,
    postInstructions,
    closeInstructions: [
      ...startGroups.closeInstructions,
      ...endGroups.closeInstructions,
    ],
  };
}

/**
 * Build an instruction to close an encoded VAA account, recovering the rent.
 */
export async function buildCloseEncodedVaaInstruction(
  wormhole: Program<WormholeCoreBridgeSolana>,
  encodedVaa: PublicKey,
): Promise<InstructionWithEphemeralSigners> {
  const instruction = await wormhole.methods
    .closeEncodedVaa()
    .accounts({ encodedVaa })
    .instruction();
  return {
    instruction,
    signers: [],
    computeUnits: CLOSE_ENCODED_VAA_COMPUTE_BUDGET,
  };
}

/**
 * Build an instruction to create an encoded VAA account.
 *
 * This is the first step to post a VAA to the Wormhole program.
 */
export async function buildEncodedVaaCreateInstruction(
  wormhole: Program<WormholeCoreBridgeSolana>,
  vaa: Buffer,
  encodedVaaKeypair: Keypair,
): Promise<InstructionWithEphemeralSigners> {
  const encodedVaaSize = vaa.length + VAA_START;
  return {
    instruction: await wormhole.account.encodedVaa.createInstruction(
      encodedVaaKeypair,
      encodedVaaSize,
    ),
    signers: [encodedVaaKeypair],
  };
}

/**
 * Find all the encoded VAA accounts that have a given write authority
 * @returns a list of the public keys of the encoded VAA accounts
 */
export async function findEncodedVaaAccountsByWriteAuthority(
  connection: Connection,
  writeAuthority: PublicKey,
  wormholeProgramId: PublicKey,
): Promise<PublicKey[]> {
  const result = await connection.getProgramAccounts(wormholeProgramId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(
            Buffer.from(sha256("account:EncodedVaa").slice(0, 8)),
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
