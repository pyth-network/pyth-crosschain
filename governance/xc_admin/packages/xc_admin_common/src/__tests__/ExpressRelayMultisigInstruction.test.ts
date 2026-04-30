import type { Idl } from "@coral-xyz/anchor";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from "../multisig_transaction";
import {
  AnchorMultisigInstruction,
  EXPRESS_RELAY_PROGRAM_ID,
} from "../multisig_transaction/AnchorMultisigInstruction";
import expressRelayIdl from "../multisig_transaction/idl/express_relay.json";

describe("AnchorExpressRelayMultisigInstruction", () => {
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
      { isSigner: true, isWritable: false, pubkey: admin },
      { isSigner: false, isWritable: true, pubkey: feeReceiverAdmin },
      { isSigner: false, isWritable: true, pubkey: expressRelayMetadata },
    ];

    const instruction = new TransactionInstruction({
      data: instructionData,
      keys,
      programId: EXPRESS_RELAY_PROGRAM_ID,
    });

    const erInstruction =
      AnchorMultisigInstruction.fromTransactionInstruction(instruction);

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
      { isSigner: true, isWritable: false, pubkey: admin },
      { isSigner: false, isWritable: true, pubkey: expressRelayMetadata },
      { isSigner: false, isWritable: true, pubkey: expressRelayFeeReceiverAta },
      { isSigner: false, isWritable: true, pubkey: feeReceiverAdminTa },
      { isSigner: false, isWritable: false, pubkey: mintFee },
      { isSigner: false, isWritable: false, pubkey: tokenProgramFee },
    ];

    const instruction = new TransactionInstruction({
      data: instructionData,
      keys,
      programId: EXPRESS_RELAY_PROGRAM_ID,
    });

    const erInstruction =
      AnchorMultisigInstruction.fromTransactionInstruction(instruction);

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
    const keys = [{ isSigner: false, isWritable: true, pubkey: admin }];

    const instruction = new TransactionInstruction({
      data: unrecognizedData,
      keys,
      programId: EXPRESS_RELAY_PROGRAM_ID,
    });

    const erInstruction =
      AnchorMultisigInstruction.fromTransactionInstruction(instruction);

    expect(erInstruction.program).toBe(MultisigInstructionProgram.ExpressRelay);
    expect(erInstruction.name).toBe(UNRECOGNIZED_INSTRUCTION);
    expect(erInstruction.args).toEqual({ data: unrecognizedData });
    expect(erInstruction.accounts.remaining).toEqual(keys);
  });
});
