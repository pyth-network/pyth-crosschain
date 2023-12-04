import {
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  PublicKey,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { MESSAGE_BUFFER_PROGRAM_ID } from "../message_buffer";
import { WORMHOLE_ADDRESS } from "../wormhole";
import {
  MESH_PROGRAM_ID,
  AnchorMultisigInstruction,
  STAKING_PROGRAM_ID,
} from "./MessageBufferMultisigInstruction";
import { PythMultisigInstruction } from "./PythMultisigInstruction";
import { WormholeMultisigInstruction } from "./WormholeMultisigInstruction";
import { SystemProgramMultisigInstruction } from "./SystemProgramInstruction";
import { BpfUpgradableLoaderInstruction } from "./BpfUpgradableLoaderMultisigInstruction";
import { BPF_UPGRADABLE_LOADER } from "../bpf_upgradable_loader";
import { AnchorAccounts } from "./anchor";
import { SolanaStakingMultisigInstruction } from "./SolanaStakingMultisigInstruction";

export const UNRECOGNIZED_INSTRUCTION = "unrecognizedInstruction";
export enum MultisigInstructionProgram {
  PythOracle,
  WormholeBridge,
  MessageBuffer,
  Staking,
  Mesh,
  SystemProgram,
  BpfUpgradableLoader,
  SolanaStakingProgram,
  UnrecognizedProgram,
}

export function getProgramName(program: MultisigInstructionProgram) {
  switch (program) {
    case MultisigInstructionProgram.PythOracle:
      return "Pyth Oracle";
    case MultisigInstructionProgram.WormholeBridge:
      return "Wormhole";
    case MultisigInstructionProgram.MessageBuffer:
      return "Message Buffer";
    case MultisigInstructionProgram.SystemProgram:
      return "System Program";
    case MultisigInstructionProgram.BpfUpgradableLoader:
      return "BPF Upgradable Loader";
    case MultisigInstructionProgram.SolanaStakingProgram:
      return "Solana Staking Program";
    case MultisigInstructionProgram.UnrecognizedProgram:
      return "Unknown";
  }
}

export interface MultisigInstruction {
  readonly program: MultisigInstructionProgram;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;
}

export class UnrecognizedProgram implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.UnrecognizedProgram;
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
  ): UnrecognizedProgram {
    return new UnrecognizedProgram(
      UNRECOGNIZED_INSTRUCTION,
      { data: instruction.data },
      { named: {}, remaining: instruction.keys }
    );
  }
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
    } else if (instruction.programId.equals(this.pythOracleAddress)) {
      return PythMultisigInstruction.fromTransactionInstruction(instruction);
    } else if (
      instruction.programId.equals(MESSAGE_BUFFER_PROGRAM_ID) ||
      instruction.programId.equals(MESH_PROGRAM_ID) ||
      instruction.programId.equals(STAKING_PROGRAM_ID)
    ) {
      return AnchorMultisigInstruction.fromTransactionInstruction(instruction);
    } else if (instruction.programId.equals(SystemProgram.programId)) {
      return SystemProgramMultisigInstruction.fromTransactionInstruction(
        instruction
      );
    } else if (instruction.programId.equals(BPF_UPGRADABLE_LOADER)) {
      return BpfUpgradableLoaderInstruction.fromTransactionInstruction(
        instruction
      );
    } else if (instruction.programId.equals(StakeProgram.programId)) {
      return SolanaStakingMultisigInstruction.fromTransactionInstruction(
        instruction
      );
    } else {
      return UnrecognizedProgram.fromTransactionInstruction(instruction);
    }
  }
}

export { WormholeMultisigInstruction } from "./WormholeMultisigInstruction";
export { PythMultisigInstruction } from "./PythMultisigInstruction";
export { AnchorMultisigInstruction } from "./MessageBufferMultisigInstruction";
export { SystemProgramMultisigInstruction } from "./SystemProgramInstruction";
export { BpfUpgradableLoaderInstruction } from "./BpfUpgradableLoaderMultisigInstruction";
export { SolanaStakingMultisigInstruction } from "./SolanaStakingMultisigInstruction";
