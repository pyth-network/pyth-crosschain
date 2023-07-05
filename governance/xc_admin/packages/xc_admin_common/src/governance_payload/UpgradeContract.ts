import { ChainName } from "@certusone/wormhole-sdk";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

/** Upgrade a cosmos contract to the implementation at codeId. (Note that this requires someone to upload the new
 * contract code first to obtain a codeId.) */
export class CosmosUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ codeId: bigint }>> =
    BufferLayout.struct([BufferLayoutExt.u64be("codeId")]);

  constructor(targetChainId: ChainName, readonly codeId: bigint) {
    super(targetChainId, "UpgradeContract");
  }

  static decode(data: Buffer): CosmosUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      CosmosUpgradeContract.layout
    );
    if (!decoded) return undefined;

    return new CosmosUpgradeContract(
      decoded[0].targetChainId,
      decoded[1].codeId
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(CosmosUpgradeContract.layout, {
      codeId: this.codeId,
    });
  }
}

export class AptosAuthorizeUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ hash: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(32, "hash")]);

  constructor(targetChainId: ChainName, readonly hash: string) {
    super(targetChainId, "UpgradeContract");
  }

  static decode(data: Buffer): AptosAuthorizeUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new AptosAuthorizeUpgradeContract(
      decoded[0].targetChainId,
      decoded[1].hash
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(AptosAuthorizeUpgradeContract.layout, {
      hash: this.hash,
    });
  }
}

export class EvmUpgradeContract extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<Readonly<{ address: string }>> =
    BufferLayout.struct([BufferLayoutExt.hexBytes(20, "address")]);

  constructor(targetChainId: ChainName, readonly address: string) {
    super(targetChainId, "UpgradeContract");
  }

  static decode(data: Buffer): EvmUpgradeContract | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpgradeContract",
      this.layout
    );
    if (!decoded) return undefined;

    return new EvmUpgradeContract(decoded[0].targetChainId, decoded[1].address);
  }

  encode(): Buffer {
    return super.encodeWithPayload(EvmUpgradeContract.layout, {
      address: this.address,
    });
  }
}
