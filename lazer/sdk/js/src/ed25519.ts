import * as BufferLayout from "@solana/buffer-layout";
import { Ed25519Program, TransactionInstruction } from "@solana/web3.js";

const SIGNATURE_LEN = 64;
const PUBKEY_LEN = 32;
const MAGIC_LEN = 4;
const MESSAGE_SIZE_LEN = 2;

const readUint16LE = (data: Uint8Array, offset: number) => {
  // @ts-expect-error - crashes if offset is out of bounds
  return data[offset] | (data[offset + 1] << 8);
};

const ED25519_INSTRUCTION_LAYOUT = BufferLayout.struct<
  Readonly<{
    messageDataOffset: number;
    messageDataSize: number;
    messageInstructionIndex: number;
    numSignatures: number;
    padding: number;
    publicKeyInstructionIndex: number;
    publicKeyOffset: number;
    signatureInstructionIndex: number;
    signatureOffset: number;
  }>
>([
  BufferLayout.u8("numSignatures"),
  BufferLayout.u8("padding"),
  BufferLayout.u16("signatureOffset"),
  BufferLayout.u16("signatureInstructionIndex"),
  BufferLayout.u16("publicKeyOffset"),
  BufferLayout.u16("publicKeyInstructionIndex"),
  BufferLayout.u16("messageDataOffset"),
  BufferLayout.u16("messageDataSize"),
  BufferLayout.u16("messageInstructionIndex"),
]);

export const createEd25519Instruction = (
  message: Uint8Array,
  instructionIndex: number,
  startingOffset: number
) => {
  const signatureOffset = startingOffset + MAGIC_LEN;
  const publicKeyOffset = signatureOffset + SIGNATURE_LEN;
  const messageDataSizeOffset = publicKeyOffset + PUBKEY_LEN;
  const messageDataOffset = messageDataSizeOffset + MESSAGE_SIZE_LEN;

  const messageDataSize = readUint16LE(
    message,
    messageDataSizeOffset - startingOffset
  );

  const instructionData = Buffer.alloc(16);

  ED25519_INSTRUCTION_LAYOUT.encode(
    {
      numSignatures: 1,
      padding: 0,
      signatureOffset,
      signatureInstructionIndex: instructionIndex,
      publicKeyOffset,
      publicKeyInstructionIndex: instructionIndex,
      messageDataOffset,
      messageDataSize: messageDataSize,
      messageInstructionIndex: instructionIndex,
    },
    instructionData
  );

  return new TransactionInstruction({
    keys: [],
    programId: Ed25519Program.programId,
    data: instructionData,
  });
};