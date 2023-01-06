import { ChainId, ChainName, toChainName } from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";

export declare const Action: {
  readonly ExecutePostedVaa: 0;
  readonly UpgradeContract: 0;
  readonly AuthorizeGovernanceDataSourceTransfer: 1;
  readonly SetDataSources: 2;
  readonly SetFee: 3;
  readonly SetValidPeriod: 4;
  readonly RequestGovernanceDataSourceTransfer: 5;
};

export function toActionName(
  deserialized: Readonly<{ moduleId: number; actionId: ActionId }>
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
  } else {
    throw new Error("Invalid header, action doesn't match module");
  }
}
export declare type ActionName = keyof typeof Action;
export declare type ActionId = typeof Action[ActionName];

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
    action: ActionId;
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
export function decodeHeader(data: Buffer): PythGovernanceHeader | undefined {
  let deserialized = governanceHeaderLayout().decode(data);
  return verifyHeader(deserialized);
}

export function verifyHeader(
  deserialized: Readonly<{
    magicNumber: number;
    module: number;
    action: ActionId;
    chain: ChainId;
  }>
) {
  if (deserialized.magicNumber !== MAGIC_NUMBER) {
    return undefined;
  }

  if (!toChainName(deserialized.chain)) {
    return undefined;
  }

  try {
    let governanceHeader: PythGovernanceHeader = {
      targetChainId: toChainName(deserialized.chain),
      action: toActionName({
        actionId: deserialized.action,
        moduleId: deserialized.module,
      }),
    };
    return governanceHeader;
  } catch {
    return undefined;
  }
}

export { decodeExecutePostedVaa } from "./ExecutePostedVaa";
