import {
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { WORMHOLE_ADDRESS } from "../wormhole";
import { WormholeMultisigInstruction } from "./WormholeInstruction";

export interface MultisigInstruction {
  readonly program: string;
}

export class UnrecognizedProgram implements MultisigInstruction {
  readonly program = "Unknown program";
  private instruction: TransactionInstruction;

  constructor(instruction: TransactionInstruction) {
    this.instruction = instruction;
  }
}

export class PythMultisigInstruction implements MultisigInstruction {
  readonly program = "Pyth Oracle";
}

export class MultisigParser {
  readonly pythOracleAddress: PublicKey;
  readonly wormholeBridgeAddress: PublicKey | undefined;

  constructor(cluster: PythCluster) {
    this.pythOracleAddress = getPythProgramKeyForCluster(cluster);
    this.wormholeBridgeAddress = WORMHOLE_ADDRESS[cluster];
  }

  parseInstruction(instruction: TransactionInstruction): MultisigInstruction {
    if (
      this.wormholeBridgeAddress &&
      instruction.programId.equals(this.wormholeBridgeAddress)
    ) {
      return new WormholeMultisigInstruction(instruction);
    } else {
      return new UnrecognizedProgram(instruction);
    }
  }
}
