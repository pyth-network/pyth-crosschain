import {
  ActionName,
  PythGovernanceAction,
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import { ChainName } from "@certusone/wormhole-sdk";

export class AuthorizeGovernanceDataSourceTransfer
  implements PythGovernanceAction
{
  readonly actionName: ActionName;

  constructor(readonly targetChainId: ChainName, readonly claimVaa: Buffer) {
    this.actionName = "AuthorizeGovernanceDataSourceTransfer";
  }

  static decode(
    data: Buffer
  ): AuthorizeGovernanceDataSourceTransfer | undefined {
    const header = PythGovernanceHeader.decode(data);
    if (!header || header.action !== "AuthorizeGovernanceDataSourceTransfer")
      return undefined;

    const payload = data.subarray(PythGovernanceHeader.span);

    return new AuthorizeGovernanceDataSourceTransfer(
      header.targetChainId,
      payload
    );
  }

  encode(): Buffer {
    const headerBuffer = new PythGovernanceHeader(
      this.targetChainId,
      this.actionName
    ).encode();
    return Buffer.concat([headerBuffer, this.claimVaa]);
  }
}

export class RequestGovernanceDataSourceTransfer extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ governanceDataSourceIndex: number }>
  > = BufferLayout.struct([BufferLayout.u32be()]);

  constructor(
    targetChainId: ChainName,
    readonly governanceDataSourceIndex: number
  ) {
    super(targetChainId, "RequestGovernanceDataSourceTransfer");
  }

  static decode(data: Buffer): RequestGovernanceDataSourceTransfer | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "RequestGovernanceDataSourceTransfer",
      this.layout
    );
    if (!decoded) return undefined;

    return new RequestGovernanceDataSourceTransfer(
      decoded[0].targetChainId,
      decoded[1].governanceDataSourceIndex
    );
  }

  /** Encode CosmosUpgradeContract */
  encode(): Buffer {
    return super.encodeWithPayload(RequestGovernanceDataSourceTransfer.layout, {
      governanceDataSourceIndex: this.governanceDataSourceIndex,
    });
  }
}
