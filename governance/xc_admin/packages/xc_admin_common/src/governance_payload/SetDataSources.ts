import { PythGovernanceActionImpl, PythGovernanceHeader } from ".";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class SetDataSources extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ dataSources: DataSource[] }>
  > = BufferLayout.struct([BufferLayout.seq()]);

  constructor(header: PythGovernanceHeader, readonly codeId: bigint) {
    super(header);
    this.codeId = codeId;
  }

  static decode(data: Buffer): CosmosUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new CosmosUpgradeContract(decoded[0], decoded[1].codeId);
  }

  /** Encode CosmosUpgradeContract */
  encode(): Buffer {
    return super.encodeWithPayload(CosmosUpgradeContract.layout, {
      codeId: this.codeId,
    });
  }
}

export class SetDataSourcesInstruction extends TargetInstruction {
  constructor(targetChainId: ChainId, private dataSources: DataSource[]) {
    super(TargetAction.SetDataSources, targetChainId);
  }

  protected serializePayload(): Buffer {
    const builder = new BufferBuilder();
    builder.addUint8(this.dataSources.length);
    this.dataSources.forEach((datasource) => builder.addObject(datasource));
    return builder.build();
  }
}
