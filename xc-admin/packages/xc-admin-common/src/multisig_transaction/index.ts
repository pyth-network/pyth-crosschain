import {
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { WORMHOLE_ADDRESS } from "../wormhole";
import { WormholeMultisigInstruction } from "./WormholeMultisigInstruction";

export enum MultisigInstructionProgram {
  PythOracle,
  WormholeBridge,
  UnrecognizedProgram,
}

export interface MultisigInstruction {
  readonly program: MultisigInstructionProgram;
}

export class UnrecognizedProgram implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.UnrecognizedProgram;
  readonly instruction: TransactionInstruction;

  constructor(instruction: TransactionInstruction) {
    this.instruction = instruction;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction
  ): UnrecognizedProgram {
    return new UnrecognizedProgram(instruction);
  }
}

export class PythMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.PythOracle;
}

export class MultisigParser {
  readonly pythOracleAddress: PublicKey;
  readonly wormholeBridgeAddress: PublicKey | undefined;

  constructor(
    pythOracleAddress: PublicKey,
    wormholeBridgeAddress: PublicKey | undefined
  ) {
    this.pythOracleAddress = pythOracleAddress;
    this.wormholeBridgeAddress = wormholeBridgeAddress;
  }
  static fromCluster(cluster: PythCluster): MultisigParser {
    return new MultisigParser(
      getPythProgramKeyForCluster(cluster),
      WORMHOLE_ADDRESS[cluster]
    );
  }

  parseInstruction(instruction: TransactionInstruction): MultisigInstruction {
    if (
      this.wormholeBridgeAddress &&
      instruction.programId.equals(this.wormholeBridgeAddress)
    ) {
      return WormholeMultisigInstruction.fromTransactionInstruction(
        instruction
      );
    } else {
      return UnrecognizedProgram.fromTransactionInstruction(instruction);
    }
  }
}
