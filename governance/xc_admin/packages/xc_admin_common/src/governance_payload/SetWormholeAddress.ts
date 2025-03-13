import { ChainName } from "../chains";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class EvmSetWormholeAddress extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ address: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(20, "address")]);

  constructor(
    targetChainId: ChainName,
    readonly address: string,
  ) {
    super(targetChainId, "SetWormholeAddress");
  }

  static decode(data: Buffer): EvmSetWormholeAddress | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetWormholeAddress",
      this.layout,
    );
    if (!decoded) return undefined;

    return new EvmSetWormholeAddress(
      decoded[0].targetChainId,
      decoded[1].address,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(EvmSetWormholeAddress.layout, {
      address: this.address,
    });
  }
}

export class StarknetSetWormholeAddress extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ address: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(32, "address")]);

  constructor(
    targetChainId: ChainName,
    readonly address: string,
  ) {
    super(targetChainId, "SetWormholeAddress");
  }

  static decode(data: Buffer): StarknetSetWormholeAddress | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "SetWormholeAddress",
      this.layout,
    );
    if (!decoded) return undefined;

    return new StarknetSetWormholeAddress(
      decoded[0].targetChainId,
      decoded[1].address,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(StarknetSetWormholeAddress.layout, {
      address: this.address,
    });
  }
}
