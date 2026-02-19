import type { ChainName } from "../chains";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class UpgradeSuiLazerContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ version: bigint; hash: string }>
  > = BufferLayout.struct([
    BufferLayoutExt.u64be("version"),
    BufferLayoutExt.hexBytes(32, "hash"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly version: bigint,
    readonly hash: string,
  ) {
    super(targetChainId, "UpgradeSuiLazerContract");
  }

  static decode(data: Buffer): UpgradeSuiLazerContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeSuiLazerContract",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpgradeSuiLazerContract(
      decoded[0].targetChainId,
      decoded[1].version,
      decoded[1].hash,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeSuiLazerContract.layout, {
      version: this.version,
      hash: this.hash,
    });
  }
}

export class UpgradeCardanoLazerContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ script: number; hash: string }>
  > = BufferLayout.struct([
    BufferLayout.u8("script"),
    BufferLayoutExt.hexBytes(28, "hash"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly script: CardanoLazerScript,
    readonly hash: string,
  ) {
    super(targetChainId, "UpgradeCardanoLazerContract");
  }

  static decode(data: Buffer): UpgradeCardanoLazerContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeCardanoLazerContract",
      this.layout,
    );
    if (!decoded) return undefined;

    const { script, hash } = decoded[1];
    if (!Object.values<number>(CardanoLazerScript).includes(script))
      return undefined;

    return new UpgradeCardanoLazerContract(
      decoded[0].targetChainId,
      script as CardanoLazerScript,
      hash,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeCardanoLazerContract.layout, {
      script: this.script,
      hash: this.hash,
    });
  }
}

export type CardanoLazerScript =
  (typeof CardanoLazerScript)[keyof typeof CardanoLazerScript];

export const CardanoLazerScript = {
  spend: 1,
  withdraw: 2,
} as const;
