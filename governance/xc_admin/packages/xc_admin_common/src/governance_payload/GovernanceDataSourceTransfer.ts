import { PythGovernanceActionImpl, PythGovernanceHeader } from ".";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

export class AuthorizeGovernanceDataSourceTransfer extends PythGovernanceActionImpl {
  protected constructor(
    header: PythGovernanceHeader,
    readonly claimVaa: Buffer
  ) {
    super(header);
  }

  static layout(
    vaaLength: number
  ): BufferLayout.Structure<Readonly<{ claimVaa: Buffer }>> {
    return BufferLayout.struct([BufferLayoutExt.buffer(vaaLength)]);
  }

  static decode(
    data: Buffer
  ): AuthorizeGovernanceDataSourceTransfer | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "AuthorizeGovernanceDataSourceTransfer",
      this.layout(data.length - PythGovernanceHeader.span)
    );
    if (!decoded) return undefined;

    return new AuthorizeGovernanceDataSourceTransfer(
      decoded[0],
      decoded[1].claimVaa
    );
  }

  /** Encode AptosAuthorizeUpgradeContractInstruction */
  encode(): Buffer {
    return super.encodeWithPayload(this.layout(this.claimVaa.length), {
      claimVaa: this.claimVaa,
    });
  }
}

export class RequestGovernanceDataSourceTransfer extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ governanceDataSourceIndex: number }>
  > = BufferLayout.struct([BufferLayout.u32be()]);

  protected constructor(
    header: PythGovernanceHeader,
    readonly governanceDataSourceIndex: number
  ) {
    super(header);
  }

  static decode(data: Buffer): RequestGovernanceDataSourceTransfer | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "RequestGovernanceDataSourceTransfer",
      this.layout
    );
    if (!decoded) return undefined;

    return new RequestGovernanceDataSourceTransfer(
      decoded[0],
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
