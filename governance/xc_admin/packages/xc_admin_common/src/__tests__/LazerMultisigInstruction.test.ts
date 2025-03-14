import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { LazerMultisigInstruction } from "../multisig_transaction/LazerMultisigInstruction";
import {
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from "../multisig_transaction";

describe("LazerMultisigInstruction", () => {
  const mockProgramId = new PublicKey(
    "pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt",
  );
  const systemProgram = SystemProgram.programId;

  // Generate reusable keypairs for tests
  const topAuthority = PublicKey.unique();
  const storage = PublicKey.unique();
  const payer = PublicKey.unique();

  // Test recognized instruction
  test("fromInstruction should decode update instruction", () => {
    const instructionData = Buffer.from([
      // Anchor discriminator for update (from IDL)
      219,
      200,
      88,
      176,
      158,
      63,
      253,
      127,
      // trusted_signer (pubkey - 32 bytes)
      ...Array(32).fill(1),
      // expires_at (i64 - 8 bytes)
      42,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

    const keys = [
      {
        pubkey: topAuthority,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: storage,
        isSigner: false,
        isWritable: true,
      },
    ];

    const instruction = new TransactionInstruction({
      programId: mockProgramId,
      keys,
      data: instructionData,
    });

    const lazerInstruction =
      LazerMultisigInstruction.fromInstruction(instruction);

    expect(lazerInstruction.name).toBe("update");
    expect(lazerInstruction.args).toBeDefined();
    expect(lazerInstruction.args.trustedSigner).toBeDefined();
    expect(lazerInstruction.args.expiresAt).toBeDefined();
    expect(lazerInstruction.accounts).toBeDefined();
    expect(lazerInstruction.accounts.named.topAuthority).toBeDefined();
    expect(lazerInstruction.accounts.named.storage).toBeDefined();
  });

  // Test unrecognized instruction
  test("fromInstruction should handle unrecognized instruction", () => {
    const unrecognizedData = Buffer.from([1, 2, 3, 4]);
    const keys = [
      {
        pubkey: topAuthority,
        isSigner: false,
        isWritable: true,
      },
    ];

    const instruction = new TransactionInstruction({
      programId: mockProgramId,
      keys,
      data: unrecognizedData,
    });

    const lazerInstruction =
      LazerMultisigInstruction.fromInstruction(instruction);

    expect(lazerInstruction.name).toBe(UNRECOGNIZED_INSTRUCTION);
    expect(lazerInstruction.args).toEqual({ data: unrecognizedData });
    expect(lazerInstruction.accounts.remaining).toEqual(keys);
  });

  // Test initialize instruction
  test("fromInstruction should decode initialize instruction", () => {
    const instructionData = Buffer.from([
      // Anchor discriminator for initialize (from IDL)
      175,
      175,
      109,
      31,
      13,
      152,
      155,
      237,
      // top_authority (pubkey - 32 bytes)
      ...Array(32).fill(2),
      // treasury (pubkey - 32 bytes)
      ...Array(32).fill(3),
    ]);

    const keys = [
      {
        pubkey: payer,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: storage,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: systemProgram,
        isSigner: false,
        isWritable: false,
      },
    ];

    const instruction = new TransactionInstruction({
      programId: mockProgramId,
      keys,
      data: instructionData,
    });

    const lazerInstruction =
      LazerMultisigInstruction.fromInstruction(instruction);

    expect(lazerInstruction.name).toBe("initialize");
    expect(lazerInstruction.args).toBeDefined();
    expect(lazerInstruction.args.topAuthority).toBeDefined();
    expect(lazerInstruction.args.treasury).toBeDefined();
    expect(lazerInstruction.accounts).toBeDefined();
    expect(lazerInstruction.accounts.named.payer).toBeDefined();
    expect(lazerInstruction.accounts.named.storage).toBeDefined();
    expect(lazerInstruction.accounts.named.systemProgram).toBeDefined();
  });

  // Test program field
  test("should have correct program type", () => {
    const instruction = new TransactionInstruction({
      programId: mockProgramId,
      keys: [],
      data: Buffer.from([]),
    });

    const lazerInstruction =
      LazerMultisigInstruction.fromInstruction(instruction);
    expect(lazerInstruction.program).toBe(MultisigInstructionProgram.Lazer);
  });
});
