import {
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { WORMHOLE_ADDRESS } from "../wormhole";
import { WormholeInstruction } from "./WormholeInstruction";

export interface MultisigInstruction {}

export class UnrecognizedInstruction implements MultisigInstruction {
  private instruction: TransactionInstruction;
  constructor(instruction: TransactionInstruction) {
    this.instruction = instruction;
  }
}

export class PythInstruction implements MultisigInstruction {}

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
      return new WormholeInstruction(instruction);
    } else {
      return new UnrecognizedInstruction(instruction);
    }
  }
}
