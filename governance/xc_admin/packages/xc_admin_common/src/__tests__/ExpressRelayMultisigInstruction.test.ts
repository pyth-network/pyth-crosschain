import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  EXPRESS_RELAY_PROGRAM_ID,
  ExpressRelayMultisigInstruction,
} from "../multisig_transaction/ExpressRelayMultisigInstruction";
import {
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from "../multisig_transaction";
import expressRelayIdl from "../multisig_transaction/idl/express_relay.json";

describe("ExpressRelayMultisigInstruction", () => {
  const coder = new BorshInstructionCoder(expressRelayIdl as Idl);

  const admin = PublicKey.unique();
  const feeReceiverAdmin = PublicKey.unique();
  const expressRelayMetadata = PublicKey.unique();
  const expressRelayFeeReceiverAta = PublicKey.unique();
  const feeReceiverAdminTa = PublicKey.unique();
  const mintFee = PublicKey.unique();
  const tokenProgramFee = SystemProgram.programId;

  test("fromInstruction should decode withdrawFees instruction", () => {
    const instructionData = coder.encode("withdrawFees", {});
    const keys = [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: feeReceiverAdmin, isSigner: false, isWritable: true },
      { pubkey: expressRelayMetadata, isSigner: false, isWritable: true },
    ];

    const instruction = new TransactionInstruction({
      programId: EXPRESS_RELAY_PROGRAM_ID,
      keys,
      data: instructionData,
    });

    const erInstruction =
      ExpressRelayMultisigInstruction.fromInstruction(instruction);

    expect(erInstruction.program).toBe(MultisigInstructionProgram.ExpressRelay);
    expect(erInstruction.name).toBe("withdrawFees");
    expect(erInstruction.args).toEqual({});
    expect(erInstruction.accounts.named.admin?.pubkey.equals(admin)).toBe(true);
    expect(
      erInstruction.accounts.named.feeReceiverAdmin?.pubkey.equals(
        feeReceiverAdmin,
      ),
    ).toBe(true);
    expect(
      erInstruction.accounts.named.expressRelayMetadata?.pubkey.equals(
        expressRelayMetadata,
      ),
    ).toBe(true);
  });

  test("fromInstruction should decode withdrawSplFees instruction", () => {
    const instructionData = coder.encode("withdrawSplFees", {});
    const keys = [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: expressRelayMetadata, isSigner: false, isWritable: true },
      { pubkey: expressRelayFeeReceiverAta, isSigner: false, isWritable: true },
      { pubkey: feeReceiverAdminTa, isSigner: false, isWritable: true },
      { pubkey: mintFee, isSigner: false, isWritable: false },
      { pubkey: tokenProgramFee, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      programId: EXPRESS_RELAY_PROGRAM_ID,
      keys,
      data: instructionData,
    });

    const erInstruction =
      ExpressRelayMultisigInstruction.fromInstruction(instruction);

    expect(erInstruction.program).toBe(MultisigInstructionProgram.ExpressRelay);
    expect(erInstruction.name).toBe("withdrawSplFees");
    expect(erInstruction.args).toEqual({});
    expect(
      erInstruction.accounts.named.expressRelayFeeReceiverAta?.pubkey.equals(
        expressRelayFeeReceiverAta,
      ),
    ).toBe(true);
    expect(
      erInstruction.accounts.named.feeReceiverAdminTa?.pubkey.equals(
        feeReceiverAdminTa,
      ),
    ).toBe(true);
    expect(erInstruction.accounts.named.mintFee?.pubkey.equals(mintFee)).toBe(
      true,
    );
  });

  test("fromInstruction should handle unrecognized instruction", () => {
    const unrecognizedData = Buffer.from([1, 2, 3, 4]);
    const keys = [{ pubkey: admin, isSigner: false, isWritable: true }];

    const instruction = new TransactionInstruction({
      programId: EXPRESS_RELAY_PROGRAM_ID,
      keys,
      data: unrecognizedData,
    });

    const erInstruction =
      ExpressRelayMultisigInstruction.fromInstruction(instruction);

    expect(erInstruction.program).toBe(MultisigInstructionProgram.ExpressRelay);
    expect(erInstruction.name).toBe(UNRECOGNIZED_INSTRUCTION);
    expect(erInstruction.args).toEqual({ data: unrecognizedData });
    expect(erInstruction.accounts.remaining).toEqual(keys);
  });
});
