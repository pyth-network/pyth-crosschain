import { PythGovernanceActionImpl } from "./PythGovernanceAction";
import * as BufferLayout from "@solana/buffer-layout";
import { ChainName } from "../chains";
import { pyth_lazer_transaction } from "@pythnetwork/pyth-lazer-state-sdk/governance";

/** Executes a Lazer governance instruction with the specified directives */
export class LazerExecute extends PythGovernanceActionImpl {
  static layout: BufferLayout.Structure<
    Readonly<{
      governanceInstruction: Uint8Array;
    }>
  > = BufferLayout.struct([
    BufferLayout.blob(new BufferLayout.GreedyCount(), "governanceInstruction"),
  ]);

  constructor(
    targetChainId: ChainName,
    readonly directives: pyth_lazer_transaction.IGovernanceDirective[],
    readonly minExecutionTimestamp?: Date,
    readonly maxExecutionTimestamp?: Date,
    readonly governanceSequenceNo?: number,
  ) {
    super(targetChainId, "LazerExecute");
  }

  static decode(data: Buffer): LazerExecute | undefined {
    const decoded = PythGovernanceActionImpl.decodeWithPayload(
      data,
      "LazerExecute",
      this.layout,
    );
    if (!decoded) return undefined;

    try {
      // Decode the protobuf GovernanceInstruction
      const governanceInstruction =
        pyth_lazer_transaction.GovernanceInstruction.decode(
          decoded[1].governanceInstruction,
        );

      return new LazerExecute(
        decoded[0].targetChainId,
        governanceInstruction.directives || [],
        governanceInstruction.minExecutionTimestamp
          ? new Date(
              governanceInstruction.minExecutionTimestamp.seconds * 1000 +
                (governanceInstruction.minExecutionTimestamp.nanos || 0) /
                  1000000,
            )
          : undefined,
        governanceInstruction.maxExecutionTimestamp
          ? new Date(
              governanceInstruction.maxExecutionTimestamp.seconds * 1000 +
                (governanceInstruction.maxExecutionTimestamp.nanos || 0) /
                  1000000,
            )
          : undefined,
        governanceInstruction.governanceSequenceNo || undefined,
      );
    } catch (error) {
      console.error("Failed to decode Lazer governance instruction:", error);
      return undefined;
    }
  }

  encode(): Buffer {
    try {
      // Create the GovernanceInstruction protobuf message
      const governanceInstruction =
        pyth_lazer_transaction.GovernanceInstruction.create({
          directives: this.directives,
          minExecutionTimestamp: this.minExecutionTimestamp
            ? {
                seconds: Math.floor(
                  this.minExecutionTimestamp.getTime() / 1000,
                ),
                nanos: (this.minExecutionTimestamp.getTime() % 1000) * 1000000,
              }
            : undefined,
          maxExecutionTimestamp: this.maxExecutionTimestamp
            ? {
                seconds: Math.floor(
                  this.maxExecutionTimestamp.getTime() / 1000,
                ),
                nanos: (this.maxExecutionTimestamp.getTime() % 1000) * 1000000,
              }
            : undefined,
          governanceSequenceNo: this.governanceSequenceNo,
        });

      // Validate the message before encoding
      const error = pyth_lazer_transaction.GovernanceInstruction.verify(
        governanceInstruction,
      );
      if (error) {
        throw new Error(`GovernanceInstruction validation failed: ${error}`);
      }

      // Encode the protobuf message to bytes
      const encodedInstruction =
        pyth_lazer_transaction.GovernanceInstruction.encode(
          governanceInstruction,
        ).finish();

      // Create a layout with the known instruction length for encoding
      const layout_with_known_span: BufferLayout.Structure<
        Readonly<{
          governanceInstruction: Uint8Array;
        }>
      > = BufferLayout.struct([
        BufferLayout.blob(encodedInstruction.length, "governanceInstruction"),
      ]);

      return super.encodeWithPayload(layout_with_known_span, {
        governanceInstruction: encodedInstruction,
      });
    } catch (error) {
      console.error("LazerExecute encoding error:", error);
      console.error("Directives:", JSON.stringify(this.directives, null, 2));
      console.error("minExecutionTimestamp:", this.minExecutionTimestamp);
      console.error("maxExecutionTimestamp:", this.maxExecutionTimestamp);
      console.error("governanceSequenceNo:", this.governanceSequenceNo);
      throw error;
    }
  }
}
