import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from "./index";
import { AnchorAccounts, resolveAccountNames } from "./anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Idl, BorshInstructionCoder } from "@coral-xyz/anchor";
import lazerIdl from "./idl/lazer.json";

export class LazerMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.Lazer;
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

  static fromInstruction(
    instruction: TransactionInstruction,
  ): LazerMultisigInstruction {
    // TODO: This is a hack to transform the IDL to be compatible with the anchor version we are using, we can't upgrade anchor to 0.30.1 because then the existing idls will break
    const idl = lazerIdl as Idl;

    const coder = new BorshInstructionCoder(idl);

    const deserializedData = coder.decode(instruction.data);

    if (deserializedData) {
      return new LazerMultisigInstruction(
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(idl, deserializedData.name, instruction),
      );
    } else {
      return new LazerMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys },
      );
    }
  }
}
