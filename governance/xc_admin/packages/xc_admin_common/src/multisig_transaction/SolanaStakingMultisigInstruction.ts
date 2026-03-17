import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import type {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { StakeInstruction, StakeProgram } from "@solana/web3.js";
import type { MultisigInstruction } from ".";
import { MultisigInstructionProgram, UNRECOGNIZED_INSTRUCTION } from ".";
import type { AnchorAccounts } from "./anchor";

export class SolanaStakingMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.SolanaStakingProgram;
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
  ): SolanaStakingMultisigInstruction {
    try {
      const type = StakeInstruction.decodeInstructionType(instruction);
      switch (type) {
        case "Deactivate": {
          const decodedDeactivate =
            StakeInstruction.decodeDeactivate(instruction);
          return new SolanaStakingMultisigInstruction(
            "Deactivate",
            {},
            {
              named: {
                authorizedPubkey: {
                  isSigner: true,
                  isWritable: false,
                  pubkey: decodedDeactivate.authorizedPubkey,
                },
                stakePubkey: {
                  isSigner: false,
                  isWritable: true,
                  pubkey: decodedDeactivate.stakePubkey,
                },
              },
              remaining: [],
            },
          );
        }
        case "Delegate": {
          const decodedDelegate = StakeInstruction.decodeDelegate(instruction);
          return new SolanaStakingMultisigInstruction(
            "Delegate",
            {},
            {
              named: {
                authorizedPubkey: {
                  isSigner: true,
                  isWritable: false,
                  pubkey: decodedDelegate.authorizedPubkey,
                },
                stakePubkey: {
                  isSigner: false,
                  isWritable: true,
                  pubkey: decodedDelegate.stakePubkey,
                },
                votePubkey: {
                  isSigner: false,
                  isWritable: false,
                  pubkey: decodedDelegate.votePubkey,
                },
              },
              remaining: [],
            },
          );
        }
        case "Initialize": {
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
                  isSigner: false,
                  isWritable: true,
                  pubkey: decodedInitialize.stakePubkey,
                },
              },
              remaining: [],
            },
          );
        }
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
            bytes: bs58.encode(Buffer.from([2, 0, 0, 0])),
            offset: 0,
          },
        },
        {
          memcmp: {
            bytes: staker.toBase58(),
            offset: 12,
          },
        },
        {
          memcmp: {
            bytes: voterAccount.toBase58(),
            offset: 124,
          },
        },
        {
          memcmp: {
            bytes: bs58.encode(Buffer.from("ff".repeat(8), "hex")), // account is active
            offset: 172,
          },
        },
      ],
    },
  );

  return stakeAccounts.map((account) => account.pubkey);
}
