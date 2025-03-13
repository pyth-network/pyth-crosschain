import { SystemInstruction, TransactionInstruction } from "@solana/web3.js";
import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts } from "./anchor";

export class SystemProgramMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.SystemProgram;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    name: string,
    args: { [key: string]: any },
    accounts: AnchorAccounts,
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction,
  ): SystemProgramMultisigInstruction {
    try {
      const instructionType =
        SystemInstruction.decodeInstructionType(instruction);
      let data;
      switch (instructionType) {
        case "AdvanceNonceAccount":
          data = SystemInstruction.decodeNonceAdvance(instruction);
          break;
        case "Allocate":
          data = SystemInstruction.decodeAllocate(instruction);
          break;
        case "AllocateWithSeed":
          data = SystemInstruction.decodeAllocateWithSeed(instruction);
          break;
        case "Assign":
          data = SystemInstruction.decodeAssign(instruction);
          break;
        case "AssignWithSeed":
          data = SystemInstruction.decodeAssignWithSeed(instruction);
          break;
        case "AuthorizeNonceAccount":
          data = SystemInstruction.decodeNonceAuthorize(instruction);
          break;
        case "Create":
          data = SystemInstruction.decodeCreateAccount(instruction);
          break;
        case "CreateWithSeed":
          data = SystemInstruction.decodeCreateWithSeed(instruction);
          break;
        case "InitializeNonceAccount":
          data = SystemInstruction.decodeNonceInitialize(instruction);
          break;
        case "Transfer":
          data = SystemInstruction.decodeTransfer(instruction);
          break;
        case "TransferWithSeed":
          data = SystemInstruction.decodeTransferWithSeed(instruction);
          break;
        case "WithdrawNonceAccount":
          data = SystemInstruction.decodeNonceWithdraw(instruction);
          break;
        case "UpgradeNonceAccount": // I couldn't find the decode function for this
          throw Error("UpgradeNonceAccount not implemented");
      }
      return new SystemProgramMultisigInstruction(instructionType, data, {
        named: {},
        remaining: [],
      });
    } catch {
      return new SystemProgramMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys },
      );
    }
  }
}
