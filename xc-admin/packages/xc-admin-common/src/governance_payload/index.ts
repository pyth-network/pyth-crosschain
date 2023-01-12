import {
  ChainId,
  ChainName,
  toChainId,
  toChainName,
} from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { PACKET_DATA_SIZE } from "@solana/web3.js";
import { ExecutePostedVaa } from "./ExecutePostedVaa";

export interface PythGovernanceAction {
  readonly targetChainId: ChainName;
  encode(): Buffer;
}

/** Magic number */
export const MAGIC_NUMBER = 0x4d475450;

export const MODULE_EXECUTOR = 0;
/** Each of the actions that can be directed to the Executor Module */
export const ExecutorAction = {
  ExecutePostedVaa: 0,
} as const;

/** Each of the actions that can be directed to the Target Module */
export const MODULE_TARGET = 1;
export const TargetAction = {
  UpgradeContract: 0,
  AuthorizeGovernanceDataSourceTransfer: 1,
  SetDataSources: 2,
  SetFee: 3,
  SetValidPeriod: 4,
  RequestGovernanceDataSourceTransfer: 5,
} as const;

export declare type ActionName =
  | keyof typeof ExecutorAction
  | keyof typeof TargetAction;

/** Helper to get the ActionName from a (moduleId, actionId) tuple*/
export function toActionName(
  deserialized: Readonly<{ moduleId: number; actionId: number }>
): ActionName {
  if (deserialized.moduleId == MODULE_EXECUTOR && deserialized.actionId == 0) {
    return "ExecutePostedVaa";
  } else if (deserialized.moduleId == MODULE_TARGET) {
    switch (deserialized.actionId) {
      case 0:
        return "UpgradeContract";
      case 1:
        return "AuthorizeGovernanceDataSourceTransfer";
      case 2:
        return "SetDataSources";
      case 3:
        return "SetFee";
      case 4:
        return "SetValidPeriod";
      case 5:
        return "RequestGovernanceDataSourceTransfer";
    }
  }
  throw new Error("Invalid header, action doesn't match module");
}

/** Governance header that should be in every Pyth crosschain governance message*/
export class PythGovernanceHeader {
  readonly targetChainId: ChainName;
  readonly action: ActionName;
  static layout: BufferLayout.Structure<
    Readonly<{
      magicNumber: number;
      module: number;
      action: number;
      chain: ChainId;
    }>
  > = BufferLayout.struct(
    [
      BufferLayout.u32("magicNumber"),
      BufferLayout.u8("module"),
      BufferLayout.u8("action"),
      BufferLayout.u16be("chain"),
    ],
    "header"
  );
  /** Span of the serialized governance header */
  static span = 8;

  constructor(targetChainId: ChainName, action: ActionName) {
    this.targetChainId = targetChainId;
    this.action = action;
  }
  /** Decode Pyth Governance Header */
  static decode(data: Buffer): PythGovernanceHeader {
    let deserialized = this.layout.decode(data);
    if (deserialized.magicNumber !== MAGIC_NUMBER) {
      throw new Error("Wrong magic number");
    }

    if (!toChainName(deserialized.chain)) {
      throw new Error("Chain Id not found");
    }

    return new PythGovernanceHeader(
      toChainName(deserialized.chain),
      toActionName({
        actionId: deserialized.action,
        moduleId: deserialized.module,
      })
    );
  }

  /** Encode Pyth Governance Header */
  encode(): Buffer {
    // The code will crash if the payload is actually bigger than PACKET_DATA_SIZE. But PACKET_DATA_SIZE is the maximum transaction size of Solana, so our serialized payload should never be bigger than this anyway
    const buffer = Buffer.alloc(PACKET_DATA_SIZE);
    let module: number;
    let action: number;
    if (this.action in ExecutorAction) {
      module = MODULE_EXECUTOR;
      action = ExecutorAction[this.action as keyof typeof ExecutorAction];
    } else {
      module = MODULE_TARGET;
      action = TargetAction[this.action as keyof typeof TargetAction];
    }
    const span = PythGovernanceHeader.layout.encode(
      {
        magicNumber: MAGIC_NUMBER,
        module,
        action,
        chain: toChainId(this.targetChainId),
      },
      buffer
    );
    return buffer.subarray(0, span);
  }
}

/** Decode a governance payload */
export function decodeGovernancePayload(data: Buffer): PythGovernanceAction {
  const header = PythGovernanceHeader.decode(data);
  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    default:
      throw "Not supported";
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";
