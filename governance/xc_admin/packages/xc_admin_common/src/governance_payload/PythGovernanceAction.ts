import {
  ChainId,
  ChainName,
  toChainId,
  toChainName,
} from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import { PACKET_DATA_SIZE } from "@solana/web3.js";

/** Each of the actions that can be directed to the Executor Module */
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

/** Helper to get the ActionName from a (moduleId, actionId) tuple*/
export function toActionName(
  deserialized: Readonly<{ moduleId: number; actionId: number }>
): ActionName | undefined {
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
  return undefined;
}

export declare type ActionName =
  | keyof typeof ExecutorAction
  | keyof typeof TargetAction;

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
  static decode(data: Buffer): PythGovernanceHeader | undefined {
    const deserialized = safeLayoutDecode(this.layout, data);

    if (!deserialized) return undefined;

    if (deserialized.magicNumber !== MAGIC_NUMBER) return undefined;

    if (!toChainName(deserialized.chain)) return undefined;

    const actionName = toActionName({
      actionId: deserialized.action,
      moduleId: deserialized.module,
    });

    if (actionName) {
      return new PythGovernanceHeader(
        toChainName(deserialized.chain),
        actionName
      );
    } else {
      return undefined;
    }
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

export const MAGIC_NUMBER = 0x4d475450;
export const MODULE_EXECUTOR = 0;
export const MODULE_TARGET = 1;
export const MODULES = [MODULE_EXECUTOR, MODULE_TARGET];

export interface PythGovernanceAction {
  readonly targetChainId: ChainName;
  encode(): Buffer;
}

export abstract class PythGovernanceActionImpl implements PythGovernanceAction {
  readonly targetChainId: ChainName;
  readonly header: PythGovernanceHeader;

  // TODO: refactor arguments here
  protected constructor(header: PythGovernanceHeader) {
    this.header = header;
    this.targetChainId = header.targetChainId;
  }

  abstract encode(): Buffer;

  protected encodeWithPayload<T>(
    payloadLayout: BufferLayout.Layout<T>,
    payload: T
  ) {
    const headerBuffer = this.header.encode();

    const payloadBuffer = Buffer.alloc(payloadLayout.span);
    payloadLayout.encode(payload, payloadBuffer);

    return Buffer.concat([headerBuffer, payloadBuffer]);
  }

  protected static decodeWithPayload<T>(
    buffer: Buffer,
    requiredAction: ActionName,
    payloadLayout: BufferLayout.Layout<T>
  ): [PythGovernanceHeader, T] | undefined {
    const header = PythGovernanceHeader.decode(buffer);
    if (!header || header.action !== requiredAction) return undefined;

    const payload = safeLayoutDecode(
      payloadLayout,
      buffer.subarray(PythGovernanceHeader.span)
    );
    if (!payload) return undefined;

    return [header, payload];
  }
}

export function safeLayoutDecode<T>(
  layout: BufferLayout.Layout<T>,
  data: Buffer
): T | undefined {
  try {
    return layout.decode(data);
  } catch {
    return undefined;
  }
}
