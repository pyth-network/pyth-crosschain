import * as BufferLayout from "@solana/buffer-layout";
import type { TransactionInstruction } from "@solana/web3.js";
import type { MultisigInstruction } from ".";
import { MultisigInstructionProgram, UNRECOGNIZED_INSTRUCTION } from ".";
import type { AnchorAccounts } from "./anchor";

// Source: https://docs.rs/solana-program/latest/src/solana_program/loader_upgradeable_instruction.rs.html
export class BpfUpgradableLoaderInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.BpfUpgradableLoader;
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
  ): BpfUpgradableLoaderInstruction {
    try {
      const instructionTypeLayout = BufferLayout.u32("instruction");
      const typeIndex = instructionTypeLayout.decode(instruction.data);
      switch (typeIndex) {
        case 3:
          return new BpfUpgradableLoaderInstruction(
            "Upgrade",
            {},
            {
              named: {
                buffer: instruction.keys[2]!,
                clock: instruction.keys[5]!,
                program: instruction.keys[1]!,
                programData: instruction.keys[0]!,
                rent: instruction.keys[4]!,
                spill: instruction.keys[3]!,
                upgradeAuthority: instruction.keys[6]!,
              },
              remaining: instruction.keys.slice(7),
            },
          );
        case 4:
          return new BpfUpgradableLoaderInstruction(
            "SetAuthority",
            {},
            {
              named: {
                currentAuthority: instruction.keys[1]!,
                newAuthority: instruction.keys[2]!,
                programData: instruction.keys[0]!,
              },
              remaining: instruction.keys.slice(3),
            },
          );
        case 5: {
          let args;
          // Close instruction supports closing two types of accounts:
          // - A program which takes 4 keys (programData, spill, upgradeAuthority, program)
          // - A buffer which takes 3 keys (buffer, spill, upgradeAuthority)
          if (instruction.keys.length >= 4) {
            args = {
              named: {
                program: instruction.keys[3],
                programData: instruction.keys[0],
                spill: instruction.keys[1],
                upgradeAuthority: instruction.keys[2],
              },
              remaining: instruction.keys.slice(4),
            };
          } else {
            args = {
              named: {
                buffer: instruction.keys[0],
                spill: instruction.keys[1],
                upgradeAuthority: instruction.keys[2],
              },
              remaining: instruction.keys.slice(3),
            };
          }

          return new BpfUpgradableLoaderInstruction(
            "Close",
            {},
            args as AnchorAccounts,
          );
        }
        default: // Many more cases are not supported
          throw Error("Not implemented");
      }
    } catch {
      return new BpfUpgradableLoaderInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys },
      );
    }
  }
}
