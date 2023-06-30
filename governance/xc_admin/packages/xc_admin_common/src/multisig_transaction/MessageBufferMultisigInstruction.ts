import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts, resolveAccountNames } from "./anchor";
import messageBuffer from "message_buffer/idl/message_buffer.json";
import { TransactionInstruction } from "@solana/web3.js";
import { Idl, BorshCoder } from "@coral-xyz/anchor";

export class MessageBufferMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.MessageBuffer;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    name: string,
    args: { [key: string]: any },
    accounts: AnchorAccounts
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction
  ): MessageBufferMultisigInstruction {
    const messageBufferInstructionCoder = new BorshCoder(messageBuffer as Idl)
      .instruction;

    const deserializedData = messageBufferInstructionCoder.decode(
      instruction.data
    );

    if (deserializedData) {
      return new MessageBufferMultisigInstruction(
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(
          messageBuffer as Idl,
          deserializedData.name,
          instruction
        )
      );
    } else {
      return new MessageBufferMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys }
      );
    }
  }
}
