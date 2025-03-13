import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts, resolveAccountNames } from "./anchor";
import { pythIdl, pythOracleCoder } from "@pythnetwork/client";
import { TransactionInstruction } from "@solana/web3.js";
import { Idl } from "@coral-xyz/anchor";

export class PythMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.PythOracle;
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
  ): PythMultisigInstruction {
    const pythInstructionCoder = pythOracleCoder().instruction;

    const deserializedData = pythInstructionCoder.decode(instruction.data);

    if (deserializedData) {
      return new PythMultisigInstruction(
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(pythIdl as Idl, deserializedData.name, instruction),
      );
    } else {
      return new PythMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys },
      );
    }
  }
}
