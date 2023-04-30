import { ChainName } from "@certusone/wormhole-sdk";
import { PythGovernanceAction, PythGovernanceHeader } from ".";

export class CosmosUpgradeContract implements PythGovernanceAction {
  readonly targetChainId: ChainName;
  readonly codeId: bigint;

  constructor(targetChainId: ChainName, codeId: bigint) {
    this.targetChainId = targetChainId;
    this.codeId = codeId;
  }

  static span: number = 8;
  static decode(data: Buffer): CosmosUpgradeContract | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header) return undefined;

    const codeId = data.subarray(PythGovernanceHeader.span).readBigUInt64BE();
    if (!codeId) return undefined;

    return new CosmosUpgradeContract(header.targetChainId, codeId);
  }

  /** Encode CosmosUpgradeContract */
  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      "UpgradeContract"
    ).encode();

    const buffer = Buffer.alloc(
      PythGovernanceHeader.span + CosmosUpgradeContract.span
    );

    const span = buffer.writeBigUInt64BE(this.codeId);
    return Buffer.concat([headerBuffer, buffer.subarray(0, span)]);
  }
}
