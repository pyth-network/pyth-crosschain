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

/**
 * Set the wormhole address and data sources on the target chain.
 *
 * Wire format after the governance header:
 *   newWormholeAddress(20) | numSources(u8) | dataSources*
 *
 * Fee is not included; set fee separately via SetFee before migration.
 */
export class SetWormholeAddressAndDataSources implements PythGovernanceAction {
  readonly actionName: ActionName;

  constructor(
    readonly targetChainId: ChainName,
    readonly address: string,
    readonly dataSources: DataSource[],
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

    if (index !== data.length) {
      return undefined;
    }

    return new SetWormholeAddressAndDataSources(
      header.targetChainId,
      address,
      dataSources,
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

    return safeBufferConcat([
      headerBuffer,
      addressBuf,
      numSourcesBuf,
      ...dataSourceBufs,
    ]);
  }
}
