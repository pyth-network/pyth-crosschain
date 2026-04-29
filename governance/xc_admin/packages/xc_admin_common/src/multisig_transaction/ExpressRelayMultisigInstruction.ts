import type { Idl } from "@coral-xyz/anchor";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import type { AnchorAccounts } from "./anchor";
import { resolveAccountNames } from "./anchor";
import expressRelayIdl from "./idl/express_relay.json";
import type { MultisigInstruction } from "./index";
import { MultisigInstructionProgram, UNRECOGNIZED_INSTRUCTION } from "./index";

export const EXPRESS_RELAY_PROGRAM_ID = new PublicKey(
  "PytERJFhAKuNNuaiXkApLfWzwNwSNDACpigT3LwQfou",
);

export class ExpressRelayMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.ExpressRelay;
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

  static fromInstruction(
    instruction: TransactionInstruction,
  ): ExpressRelayMultisigInstruction {
    const idl = expressRelayIdl as Idl;
    const coder = new BorshInstructionCoder(idl);
    const deserializedData = coder.decode(instruction.data);

    if (deserializedData) {
      return new ExpressRelayMultisigInstruction(
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(idl, deserializedData.name, instruction),
      );
    }

    return new ExpressRelayMultisigInstruction(
      UNRECOGNIZED_INSTRUCTION,
      { data: instruction.data },
      { named: {}, remaining: instruction.keys },
    );
  }
}
