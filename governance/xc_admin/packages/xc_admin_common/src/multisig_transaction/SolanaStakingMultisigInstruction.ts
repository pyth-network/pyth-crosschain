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
          const decodedDeactivate =
            StakeInstruction.decodeDeactivate(instruction);
          return new SolanaStakingMultisigInstruction(
            "Deactivate",
            {},
            {
              named: {
                stakePubkey: {
                  pubkey: decodedDeactivate.stakePubkey,
                  isSigner: false,
                  isWritable: true,
                },
                authorizedPubkey: {
                  pubkey: decodedDeactivate.authorizedPubkey,
                  isSigner: true,
                  isWritable: false,
                },
              },
              remaining: [],
            }
          );
        case "Delegate":
          const decodedDelegate = StakeInstruction.decodeDelegate(instruction);
          return new SolanaStakingMultisigInstruction(
            "Delegate",
            {},
            {
              named: {
                stakePubkey: {
                  pubkey: decodedDelegate.stakePubkey,
                  isSigner: false,
                  isWritable: true,
                },
                votePubkey: {
                  pubkey: decodedDelegate.votePubkey,
                  isSigner: false,
                  isWritable: false,
                },
                authorizedPubkey: {
                  pubkey: decodedDelegate.authorizedPubkey,
                  isSigner: true,
                  isWritable: false,
                },
              },
              remaining: [],
            }
          );
        case "Initialize":
          const decodedInitialize =
            StakeInstruction.decodeInitialize(instruction);
          return new SolanaStakingMultisigInstruction(
            "Initialize",
            {
              authorized: decodedInitialize.authorized,
              lockup: decodedInitialize.lockup,
            },
            {
              named: {
                stakePubkey: {
                  pubkey: decodedInitialize.stakePubkey,
                  isSigner: false,
                  isWritable: true,
                },
              },
              remaining: [],
            }
          );
        case "Authorize":
        case "AuthorizeWithSeed":

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
