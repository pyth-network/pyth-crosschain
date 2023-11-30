import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
  UnrecognizedProgram,
} from ".";
import { AnchorAccounts, resolveAccountNames } from "./anchor";
import messageBuffer from "message_buffer/idl/message_buffer.json";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Idl, BorshCoder } from "@coral-xyz/anchor";
import { MESSAGE_BUFFER_PROGRAM_ID } from "../message_buffer";
import meshIdl from "@sqds/mesh/lib/mesh-idl/mesh.json";
import stakingIdl from "./idl/staking.json";

export const MESH_PROGRAM_ID = new PublicKey(
  "SMPLVC8MxZ5Bf5EfF7PaMiTCxoBAcmkbM2vkrvMK8ho"
);
export const STAKING_PROGRAM_ID = new PublicKey(
  "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ"
);

export class AnchorMultisigInstruction implements MultisigInstruction {
  readonly program: MultisigInstructionProgram;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    program: MultisigInstructionProgram,
    name: string,
    args: { [key: string]: any },
    accounts: AnchorAccounts
  ) {
    this.program = program;
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction
  ): MultisigInstruction {
    let idl: Idl;
    let program: MultisigInstructionProgram;
    switch (instruction.programId.toBase58()) {
      case MESSAGE_BUFFER_PROGRAM_ID.toBase58():
        idl = messageBuffer as Idl;
        program = MultisigInstructionProgram.MessageBuffer;
        break;
      case MESH_PROGRAM_ID.toBase58():
        idl = meshIdl as Idl;
        program = MultisigInstructionProgram.Mesh;
        break;
      case STAKING_PROGRAM_ID.toBase58():
        idl = stakingIdl as Idl;
        program = MultisigInstructionProgram.Staking;
        break;
      default:
        return UnrecognizedProgram.fromTransactionInstruction(instruction);
    }
    const instructionCoder = new BorshCoder(idl as Idl).instruction;

    const deserializedData = instructionCoder.decode(instruction.data);

    if (deserializedData) {
      return new AnchorMultisigInstruction(
        program,
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(idl as Idl, deserializedData.name, instruction)
      );
    } else {
      return new AnchorMultisigInstruction(
        program,
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys }
      );
    }
  }
}
