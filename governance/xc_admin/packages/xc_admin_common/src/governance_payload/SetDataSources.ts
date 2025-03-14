import {
  ActionName,
  PythGovernanceAction,
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import { ChainName } from "../chains";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

/** A data source is a wormhole emitter, i.e., a specific contract on a specific chain. */
export interface DataSource {
  emitterChain: number;
  emitterAddress: string;
}
const DataSourceLayout: BufferLayout.Structure<DataSource> =
  BufferLayout.struct([
    BufferLayout.u16be("emitterChain"),
    BufferLayoutExt.hexBytes(32, "emitterAddress"),
  ]);

/** Set the data sources (where price updates must come from) on targetChainId to the provided values. */
export class SetDataSources implements PythGovernanceAction {
  readonly actionName: ActionName;

  constructor(
    readonly targetChainId: ChainName,
    readonly dataSources: DataSource[],
  ) {
    this.actionName = "SetDataSources";
  }

  static decode(data: Buffer): SetDataSources | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "SetDataSources") {
      return undefined;
    }

    let index = PythGovernanceHeader.span;
    const numSources = BufferLayout.u8().decode(data, index);
    index += 1;
    const dataSources = [];
    for (let i = 0; i < numSources; i++) {
      dataSources.push(DataSourceLayout.decode(data, index));
      index += DataSourceLayout.span;
    }

    return new SetDataSources(header.targetChainId, dataSources);
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "SetDataSources",
    ).encode();

    const numSourcesBuf = Buffer.alloc(1);
    BufferLayout.u8().encode(this.dataSources.length, numSourcesBuf);

    const dataSourceBufs = this.dataSources.map((source) => {
      const buf = Buffer.alloc(DataSourceLayout.span);
      DataSourceLayout.encode(source, buf);
      return buf;
    });

    return Buffer.concat([headerBuffer, numSourcesBuf, ...dataSourceBufs]);
  }
}
