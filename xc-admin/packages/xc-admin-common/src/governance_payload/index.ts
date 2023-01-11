import {
  ChainId,
  ChainName,
  toChainId,
  toChainName,
} from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { ExecutePostedVaa } from "./ExecutePostedVaa";

export interface PythGovernanceAction {}

class UnknownGovernanceAction {
  readonly data: Buffer;

  constructor(data: Buffer) {
    this.data = data;
  }
}

export const ExecutorAction = {
  ExecutePostedVaa: 0,
} as const;

export const TargetAction = {
  UpgradeContract: 0,
  AuthorizeGovernanceDataSourceTransfer: 1,
  SetDataSources: 2,
  SetFee: 3,
  SetValidPeriod: 4,
  RequestGovernanceDataSourceTransfer: 5,
} as const;

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
export declare type ActionName =
  | keyof typeof ExecutorAction
  | keyof typeof TargetAction;

export type PythGovernanceHeader = {
  targetChainId: ChainName;
  action: ActionName;
};

export const MAGIC_NUMBER = 0x4d475450;
export const MODULE_EXECUTOR = 0;
export const MODULE_TARGET = 1;

export function governanceHeaderLayout(): BufferLayout.Structure<
  Readonly<{
    magicNumber: number;
    module: number;
    action: number;
    chain: ChainId;
  }>
> {
  return BufferLayout.struct(
    [
      BufferLayout.u32("magicNumber"),
      BufferLayout.u8("module"),
      BufferLayout.u8("action"),
      BufferLayout.u16be("chain"),
    ],
    "header"
  );
}

/** Decode Pyth Governance Header and return undefined if the header is invalid */
export function decodeHeader(data: Buffer): PythGovernanceHeader {
  let deserialized = governanceHeaderLayout().decode(data);
  return verifyHeader(deserialized);
}

export function encodeHeader(
  src: PythGovernanceHeader,
  buffer: Buffer
): number {
  let module: number;
  let action: number;
  if (src.action in ExecutorAction) {
    module = MODULE_EXECUTOR;
    action = ExecutorAction[src.action as keyof typeof ExecutorAction];
  } else {
    module = MODULE_TARGET;
    action = TargetAction[src.action as keyof typeof TargetAction];
  }
  return governanceHeaderLayout().encode(
    {
      magicNumber: MAGIC_NUMBER,
      module,
      action,
      chain: toChainId(src.targetChainId),
    },
    buffer
  );
}

export function verifyHeader(
  deserialized: Readonly<{
    magicNumber: number;
    module: number;
    action: number;
    chain: ChainId;
  }>
): PythGovernanceHeader {
  if (deserialized.magicNumber !== MAGIC_NUMBER) {
    throw new Error("Wrong magic number");
  }

  if (!toChainName(deserialized.chain)) {
    throw new Error("Chain Id not found");
  }

  let governanceHeader: PythGovernanceHeader = {
    targetChainId: toChainName(deserialized.chain),
    action: toActionName({
      actionId: deserialized.action,
      moduleId: deserialized.module,
    }),
  };
  return governanceHeader;
}

export function decodeGovernancePayload(data: Buffer): PythGovernanceAction {
  const header = decodeHeader(data);
  switch (header.action) {
    case "ExecutePostedVaa":
      return ExecutePostedVaa.decode(data);
    default:
      return new UnknownGovernanceAction(data);
  }
}

export { ExecutePostedVaa } from "./ExecutePostedVaa";
