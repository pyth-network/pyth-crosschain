import { TransactionInstruction } from "@solana/web3.js";
import {
  MultisigInstruction,
  MultisigInstructionProgram,
  UNRECOGNIZED_INSTRUCTION,
} from ".";
import { AnchorAccounts } from "./anchor";
import * as BufferLayout from "@solana/buffer-layout";

// Source: https://docs.rs/solana-program/latest/src/solana_program/loader_upgradeable_instruction.rs.html
export class BpfUpgradableLoaderInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.BpfUpgradableLoader;
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
                programData: instruction.keys[0],
                program: instruction.keys[1],
                buffer: instruction.keys[2],
                spill: instruction.keys[3],
                rent: instruction.keys[4],
                clock: instruction.keys[5],
                upgradeAuthority: instruction.keys[6],
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
                programData: instruction.keys[0],
                currentAuthority: instruction.keys[1],
                newAuthority: instruction.keys[2],
              },
              remaining: instruction.keys.slice(3),
            },
          );
        case 5:
          let args;
          // Close instruction supports closing two types of accounts:
          // - A program which takes 4 keys (programData, spill, upgradeAuthority, program)
          // - A buffer which takes 3 keys (buffer, spill, upgradeAuthority)
          if (instruction.keys.length >= 4) {
            args = {
              named: {
                programData: instruction.keys[0],
                spill: instruction.keys[1],
                upgradeAuthority: instruction.keys[2],
                program: instruction.keys[3],
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

          return new BpfUpgradableLoaderInstruction("Close", {}, args);
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
