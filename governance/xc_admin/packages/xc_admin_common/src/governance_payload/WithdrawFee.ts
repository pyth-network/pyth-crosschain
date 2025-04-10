import {
  PythGovernanceActionImpl,
  PythGovernanceHeader,
} from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import * as BufferLayoutExt from "./BufferLayoutExt";
import { ChainName } from "../chains";

/** Withdraw fees from the target chain to the specified address */
export class WithdrawFee extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{ targetAddress: string; amount: bigint }>
  > = BufferLayout.struct([
    BufferLayoutExt.hexBytes(20, "targetAddress"), // Ethereum address as hex string
    BufferLayoutExt.u256be("amount"),             // uint256 for amount in wei
  ]);

  constructor(
    targetChainId: ChainName,
    readonly targetAddress: Buffer,
    readonly amount: bigint,
  ) {
    super(targetChainId, "WithdrawFee");
  }

  static decode(data: Buffer): WithdrawFee | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "WithdrawFee",
      WithdrawFee.layout,
    );
    if (!decoded) return undefined;

    return new WithdrawFee(
      decoded[0].targetChainId,
      Buffer.from(decoded[1].targetAddress, 'hex'),
      decoded[1].amount,
    );
  }

  encode(): Buffer {
    return super.encodeWithPayload(WithdrawFee.layout, {
      targetAddress: this.targetAddress.toString('hex'),
      amount: this.amount,
    });
  }
}
