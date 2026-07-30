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
 * Migrate the wormhole address, price data sources, and governance emitter
 * on the target chain.
 *
 * Wire format after the governance header:
 *   newWormholeAddress(20) |
 *   numSources(u8) | [emitterChain(u16be) | emitterAddress(32)]* |
 *   governanceEmitterChain(u16be) | governanceEmitterAddress(32) |
 *   governanceDataSourceIndex(u32be)
 *
 * Fee is not included; set fee separately via SetFee before migration.
 */
export class MigrateGovernanceAndWormhole implements PythGovernanceAction {
  readonly actionName: ActionName;

  constructor(
    readonly targetChainId: ChainName,
    readonly address: string,
    readonly dataSources: DataSource[],
    readonly governanceDataSource: DataSource,
    readonly governanceDataSourceIndex: number,
  ) {
    this.actionName = "MigrateGovernanceAndWormhole";
  }

  static decode(data: Buffer): MigrateGovernanceAndWormhole | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "MigrateGovernanceAndWormhole") {
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

    const governanceDataSource = DataSourceLayout.decode(data, index);
    index += DataSourceLayout.span;

    const governanceDataSourceIndex = BufferLayout.u32be().decode(data, index);
    index += 4;

    if (index !== data.length) {
      return undefined;
    }

    return new MigrateGovernanceAndWormhole(
      header.targetChainId,
      address,
      dataSources,
      governanceDataSource,
      governanceDataSourceIndex,
    );
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "MigrateGovernanceAndWormhole",
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

    const governanceDataSourceBuf = Buffer.alloc(DataSourceLayout.span);
    DataSourceLayout.encode(
      this.governanceDataSource,
      governanceDataSourceBuf,
    );

    const governanceDataSourceIndexBuf = Buffer.alloc(4);
    BufferLayout.u32be().encode(
      this.governanceDataSourceIndex,
      governanceDataSourceIndexBuf,
    );

    return safeBufferConcat([
      headerBuffer,
      addressBuf,
      numSourcesBuf,
      ...dataSourceBufs,
      governanceDataSourceBuf,
      governanceDataSourceIndexBuf,
    ]);
  }
}
