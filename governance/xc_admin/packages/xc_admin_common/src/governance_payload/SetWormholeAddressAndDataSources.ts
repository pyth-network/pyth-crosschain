import * as BufferLayout from "@solana/buffer-layout";
import type { ChainName } from "../chains";
import { safeBufferConcat } from "../utils/buffer";
import * as BufferLayoutExt from "./BufferLayoutExt";
import type { ActionName, PythGovernanceAction } from "./PythGovernanceAction";
import { PythGovernanceHeader } from "./PythGovernanceAction";
import type { DataSource } from "./SetDataSources";

const DataSourceLayout: BufferLayout.Structure<DataSource> =
  BufferLayout.struct([
    BufferLayout.u16be("emitterChain"),
    BufferLayoutExt.hexBytes(32, "emitterAddress"),
  ]);

const FeeLayout: BufferLayout.Structure<
  Readonly<{ newFeeValue: bigint; newFeeExpo: bigint }>
> = BufferLayout.struct([
  BufferLayoutExt.u64be("newFeeValue"),
  BufferLayoutExt.u64be("newFeeExpo"),
]);

/**
 * Set the wormhole address, data sources, and fee on the target chain.
 *
 * Wire format after the governance header:
 *   newWormholeAddress(20) | numSources(u8) | dataSources* | newFeeValue(u64be) | newFeeExpo(u64be)
 */
export class SetWormholeAddressAndDataSources implements PythGovernanceAction {
  readonly actionName: ActionName;

  constructor(
    readonly targetChainId: ChainName,
    readonly address: string,
    readonly dataSources: DataSource[],
    readonly newFeeValue: bigint,
    readonly newFeeExpo: bigint,
  ) {
    this.actionName = "SetWormholeAddressAndDataSources";
  }

  static decode(data: Buffer): SetWormholeAddressAndDataSources | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "SetWormholeAddressAndDataSources") {
      return undefined;
    }

    let index = PythGovernanceHeader.span;
    const address = BufferLayoutExt.hexBytes(20).decode(data, index);
    index += 20;

    const numSources = BufferLayout.u8().decode(data, index);
    index += 1;
    const dataSources = [];
    for (let i = 0; i < numSources; i++) {
      dataSources.push(DataSourceLayout.decode(data, index));
      index += DataSourceLayout.span;
    }

    const fee = FeeLayout.decode(data, index);

    return new SetWormholeAddressAndDataSources(
      header.targetChainId,
      address,
      dataSources,
      fee.newFeeValue,
      fee.newFeeExpo,
    );
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "SetWormholeAddressAndDataSources",
    ).encode();

    const addressBuf = Buffer.alloc(20);
    BufferLayoutExt.hexBytes(20).encode(this.address, addressBuf);

    const numSourcesBuf = Buffer.alloc(1);
    BufferLayout.u8().encode(this.dataSources.length, numSourcesBuf);

    const dataSourceBufs = this.dataSources.map((source) => {
      const buf = Buffer.alloc(DataSourceLayout.span);
      DataSourceLayout.encode(source, buf);
      return buf;
    });

    const feeBuf = Buffer.alloc(FeeLayout.span);
    FeeLayout.encode(
      {
        newFeeExpo: this.newFeeExpo,
        newFeeValue: this.newFeeValue,
      },
      feeBuf,
    );

    return safeBufferConcat([
      headerBuffer,
      addressBuf,
      numSourcesBuf,
      ...dataSourceBufs,
      feeBuf,
    ]);
  }
}
