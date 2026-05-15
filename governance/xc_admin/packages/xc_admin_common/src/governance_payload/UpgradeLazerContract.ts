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
      hash: this.hash,
      version: this.version,
    });
  }
}

export class UpgradeCardanoSpendScript extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ hash: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(28, "hash")]);

  constructor(
    targetChainId: ChainName,
    readonly hash: string,
  ) {
    super(targetChainId, "UpgradeCardanoSpendScript");
  }

  static decode(data: Buffer): UpgradeCardanoSpendScript | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeCardanoSpendScript",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpgradeCardanoSpendScript(
      decoded[0].targetChainId,
      decoded[1].hash,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeCardanoSpendScript.layout, {
      hash: this.hash,
    });
  }
}

export class UpgradeCardanoWithdrawScript extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ hash: string; previousExpiresAt: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(28, "hash"),
    BufferLayoutExt.u64be("previousExpiresAt"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly hash: string,
    readonly previousExpiresAt: bigint,
  ) {
    super(targetChainId, "UpgradeCardanoWithdrawScript");
  }

  static decode(data: Buffer): UpgradeCardanoWithdrawScript | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeCardanoWithdrawScript",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpgradeCardanoWithdrawScript(
      decoded[0].targetChainId,
      decoded[1].hash,
      decoded[1].previousExpiresAt,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpgradeCardanoWithdrawScript.layout, {
      hash: this.hash,
      previousExpiresAt: this.previousExpiresAt,
    });
  }
}
