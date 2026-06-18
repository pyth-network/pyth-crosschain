import * as BufferLayout from "@solana/buffer-layout";
import type { ChainName } from "../chains";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { PythGovernanceActionImpl } from "./PythGovernanceAction";

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
      expiresAt: this.expiresAt,
      publicKey: this.publicKey,
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

  static decode(data: Buffer): UpdateTrustedSigner256Bit | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "UpdateTrustedSigner",
      this.layout,
    );
    if (!decoded) return undefined;

    return new UpdateTrustedSigner256Bit(
      decoded[0].targetChainId,
      decoded[1].publicKey,
      decoded[1].expiresAt,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(UpdateTrustedSigner256Bit.layout, {
      expiresAt: this.expiresAt,
      publicKey: this.publicKey,
    });
  }
}
