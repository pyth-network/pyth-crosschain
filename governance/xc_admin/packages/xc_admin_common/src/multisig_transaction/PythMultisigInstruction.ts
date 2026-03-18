import type { Idl } from "@coral-xyz/anchor";
import { pythIdl, pythOracleCoder } from "@pythnetwork/client";
import type { TransactionInstruction } from "@solana/web3.js";
import type { MultisigInstruction } from ".";
import { MultisigInstructionProgram, UNRECOGNIZED_INSTRUCTION } from ".";
import type { AnchorAccounts } from "./anchor";
import { resolveAccountNames } from "./anchor";

export class PythMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.PythOracle;
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: legacy typing
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    name: string,
    // biome-ignore lint/suspicious/noExplicitAny: legacy typing
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
