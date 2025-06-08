import {
  Connection,
  PublicKey,
  StakeProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts } from "./anchor";
import { StakeInstruction } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export class SolanaStakingMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.SolanaStakingProgram;
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
            },
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
            },
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
            },
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
        { named: {}, remaining: instruction.keys },
      );
    }
  }
}

export async function fetchStakeAccounts(
  connection: Connection,
  staker: PublicKey,
  voterAccount: PublicKey,
) {
  const stakeAccounts = await connection.getProgramAccounts(
    StakeProgram.programId,
    {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(Buffer.from([2, 0, 0, 0])),
          },
        },
        {
          memcmp: {
            offset: 12,
            bytes: staker.toBase58(),
          },
        },
        {
          memcmp: {
            offset: 124,
            bytes: voterAccount.toBase58(),
          },
        },
        {
          memcmp: {
            offset: 172,
            bytes: bs58.encode(Buffer.from("ff".repeat(8), "hex")), // account is active
          },
        },
      ],
    },
  );

  return stakeAccounts.map((account) => account.pubkey);
}
