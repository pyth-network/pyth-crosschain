import type { ChainName } from "../chains";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";

// 33-byte signer address, used by Sui
export class UpdateTrustedSigner264Bit extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ publicKey: string; expiresAt: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(33, "publicKey"),
    BufferLayoutExt.u64be("expiresAt"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly publicKey: string,
    readonly expiresAt: bigint,
  ) {
    super(targetChainId, "UpdateTrustedSigner");
  }

  static decode(data: Buffer): UpdateTrustedSigner264Bit | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpdateTrustedSigner",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpdateTrustedSigner264Bit(
      decoded[0].targetChainId,
      decoded[1].publicKey,
      decoded[1].expiresAt,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpdateTrustedSigner264Bit.layout, {
      publicKey: this.publicKey,
      expiresAt: this.expiresAt,
    });
  }
}

// 32-byte signer address, used by Cardano
export class UpdateTrustedSigner256Bit extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ publicKey: string; expiresAt: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(32, "publicKey"),
    BufferLayoutExt.u64be("expiresAt"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly publicKey: string,
    readonly expiresAt: bigint,
  ) {
    super(targetChainId, "UpdateTrustedSigner");
  }

  static decode(data: Buffer): UpdateTrustedSigner264Bit | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpdateTrustedSigner",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpdateTrustedSigner264Bit(
      decoded[0].targetChainId,
      decoded[1].publicKey,
      decoded[1].expiresAt,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpdateTrustedSigner264Bit.layout, {
      publicKey: this.publicKey,
      expiresAt: this.expiresAt,
    });
  }
}
