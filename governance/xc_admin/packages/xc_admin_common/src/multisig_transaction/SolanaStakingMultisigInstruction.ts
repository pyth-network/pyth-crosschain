import { TransactionInstruction } from "@solana/web3.js";
import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts } from "./anchor";
import { StakeInstruction } from "@solana/web3.js";

export class SolanaStakingMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.SolanaStakingProgram;
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
  ): SolanaStakingMultisigInstruction {
    try {
      const type = StakeInstruction.decodeInstructionType(instruction);
      switch (type) {
        case "Deactivate":
          const decoded = StakeInstruction.decodeDeactivate(instruction);
          return new SolanaStakingMultisigInstruction(
            "Deactivate",
            {},
            {
              named: {
                stakePubkey: {
                  pubkey: decoded.stakePubkey,
                  isSigner: false,
                  isWritable: true,
                },
                authorizedPubkey: {
                  pubkey: decoded.authorizedPubkey,
                  isSigner: true,
                  isWritable: false,
                },
              },
              remaining: [],
            }
          );

        case "Authorize":
        case "AuthorizeWithSeed":
        case "Delegate":
        case "Initialize":
        case "Merge":
        case "Split":
        case "Withdraw":
        case "Authorize":
          throw Error("Unsupported instruction type");
      }
    } catch {
      return new SolanaStakingMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys }
      );
    }
  }
}
