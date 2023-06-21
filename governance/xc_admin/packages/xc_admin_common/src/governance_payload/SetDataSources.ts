import {
  ActionName,
  PythGovernanceAction,
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import { ChainName } from "@certusone/wormhole-sdk";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export interface DataSource {
  emitterChain: number;
  emitterAddress: string;
}
const DataSourceLayout: BufferLayout.Structure<DataSource> =
  BufferLayout.struct([
    BufferLayout.u16("emitterChain"),
    BufferLayoutExt.hexBytes(32, "emitterAddress"),
  ]);

export class SetDataSources implements PythGovernanceAction {
  readonly actionName: ActionName;

  constructor(
    readonly targetChainId: ChainName,
    readonly dataSources: DataSource[]
  ) {
    this.actionName = "SetDataSources";
  }

  static decode(data: Buffer): SetDataSources | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "SetDataSources") {
      return undefined;
    }

    let index = PythGovernanceHeader.span;
    const dataSources = [];
    while (index < data.length) {
      dataSources.push(DataSourceLayout.decode(data, index));
      index += DataSourceLayout.span;
    }

    return new SetDataSources(header.targetChainId, dataSources);
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "SetDataSources"
    ).encode();

    const dataSourceBufs = this.dataSources.map((source) => {
      const buf = Buffer.alloc(DataSourceLayout.span);
      DataSourceLayout.encode(source, buf);
      return buf;
    });

    return Buffer.concat([headerBuffer, ...dataSourceBufs]);
  }
}
