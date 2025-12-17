import {
  getPythProgramKeyForCluster,
  type PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { SOLANA_LAZER_PROGRAM_ID } from "@pythnetwork/pyth-lazer-sdk";
import { DEFAULT_RECEIVER_PROGRAM_ID } from "@pythnetwork/pyth-solana-receiver";
import {
  PublicKey,
  StakeProgram,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import { BPF_UPGRADABLE_LOADER } from "../bpf_upgradable_loader";
import { MESSAGE_BUFFER_PROGRAM_ID } from "../message_buffer";
import {
  PRICE_STORE_PROGRAM_ID,
  PriceStoreMultisigInstruction,
} from "../price_store";
import { WORMHOLE_ADDRESS } from "../wormhole";
import {
  AnchorMultisigInstruction,
  INTEGRITY_POOL_PROGRAM_ID,
  MESH_PROGRAM_ID,
  STAKING_PROGRAM_ID,
} from "./AnchorMultisigInstruction";
import type { AnchorAccounts } from "./anchor";
import { BpfUpgradableLoaderInstruction } from "./BpfUpgradableLoaderMultisigInstruction";
import { LazerMultisigInstruction } from "./LazerMultisigInstruction";
import { PythMultisigInstruction } from "./PythMultisigInstruction";
import { SolanaStakingMultisigInstruction } from "./SolanaStakingMultisigInstruction";
import { SystemProgramMultisigInstruction } from "./SystemProgramInstruction";
import { WormholeMultisigInstruction } from "./WormholeMultisigInstruction";

export const UNRECOGNIZED_INSTRUCTION = "unrecognizedInstruction";
export enum MultisigInstructionProgram {
  PythOracle,
  WormholeBridge,
  MessageBuffer,
  Staking,
  IntegrityPool,
  Mesh,
  SystemProgram,
  BpfUpgradableLoader,
  SolanaStakingProgram,
  SolanaReceiver,
  UnrecognizedProgram,
  PythPriceStore,
  Lazer,
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
    case MultisigInstructionProgram.Mesh:
      return "Mesh Multisig Program";
    case MultisigInstructionProgram.Staking:
      return "Pyth Staking Program";
    case MultisigInstructionProgram.IntegrityPool:
      return "Integrity Pool";
    case MultisigInstructionProgram.SolanaReceiver:
      return "Pyth Solana Receiver";
    case MultisigInstructionProgram.PythPriceStore:
      return "Pyth Price Store";
    case MultisigInstructionProgram.UnrecognizedProgram:
      return "Unknown";
    case MultisigInstructionProgram.Lazer:
      return "Lazer";
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
    accounts: AnchorAccounts,
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction,
  ): UnrecognizedProgram {
    return new UnrecognizedProgram(
      UNRECOGNIZED_INSTRUCTION,
      { data: instruction.data },
      { named: {}, remaining: instruction.keys },
    );
  }
}
export class MultisigParser {
  readonly pythOracleAddress: PublicKey;
  readonly wormholeBridgeAddress: PublicKey | undefined;
  readonly pythPriceStoreAddress: PublicKey | undefined;

  constructor(
    pythOracleAddress: PublicKey,
    wormholeBridgeAddress: PublicKey | undefined,
    pythPriceStoreAddress: PublicKey | undefined,
  ) {
    this.pythOracleAddress = pythOracleAddress;
    this.wormholeBridgeAddress = wormholeBridgeAddress;
    this.pythPriceStoreAddress = pythPriceStoreAddress;
  }
  static fromCluster(cluster: PythCluster): MultisigParser {
    return new MultisigParser(
      getPythProgramKeyForCluster(cluster),
      WORMHOLE_ADDRESS[cluster],
      PRICE_STORE_PROGRAM_ID,
    );
  }

  parseInstruction(instruction: TransactionInstruction): MultisigInstruction {
    if (
      this.wormholeBridgeAddress &&
      instruction.programId.equals(this.wormholeBridgeAddress)
    ) {
      return WormholeMultisigInstruction.fromTransactionInstruction(
        instruction,
      );
    } else if (instruction.programId.equals(this.pythOracleAddress)) {
      return PythMultisigInstruction.fromTransactionInstruction(instruction);
    } else if (
      this.pythPriceStoreAddress &&
      instruction.programId.equals(this.pythPriceStoreAddress)
    ) {
      return PriceStoreMultisigInstruction.fromTransactionInstruction(
        instruction,
      );
    } else if (
      instruction.programId.equals(MESSAGE_BUFFER_PROGRAM_ID) ||
      instruction.programId.equals(MESH_PROGRAM_ID) ||
      instruction.programId.equals(STAKING_PROGRAM_ID) ||
      instruction.programId.equals(DEFAULT_RECEIVER_PROGRAM_ID) ||
      instruction.programId.equals(INTEGRITY_POOL_PROGRAM_ID)
    ) {
      return AnchorMultisigInstruction.fromTransactionInstruction(instruction);
    } else if (instruction.programId.equals(SystemProgram.programId)) {
      return SystemProgramMultisigInstruction.fromTransactionInstruction(
        instruction,
      );
    } else if (instruction.programId.equals(BPF_UPGRADABLE_LOADER)) {
      return BpfUpgradableLoaderInstruction.fromTransactionInstruction(
        instruction,
      );
    } else if (instruction.programId.equals(StakeProgram.programId)) {
      return SolanaStakingMultisigInstruction.fromTransactionInstruction(
        instruction,
      );
    } else if (
      instruction.programId.equals(new PublicKey(SOLANA_LAZER_PROGRAM_ID))
    ) {
      return LazerMultisigInstruction.fromInstruction(instruction);
    } else {
      return UnrecognizedProgram.fromTransactionInstruction(instruction);
    }
  }
}

export { AnchorMultisigInstruction } from "./AnchorMultisigInstruction";
export { idlSetBuffer } from "./anchor";
export { BpfUpgradableLoaderInstruction } from "./BpfUpgradableLoaderMultisigInstruction";
export { PythMultisigInstruction } from "./PythMultisigInstruction";
export {
  fetchStakeAccounts,
  SolanaStakingMultisigInstruction,
} from "./SolanaStakingMultisigInstruction";
export { SystemProgramMultisigInstruction } from "./SystemProgramInstruction";
export { WormholeMultisigInstruction } from "./WormholeMultisigInstruction";
