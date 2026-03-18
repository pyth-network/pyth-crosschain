import { createReadOnlyWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import type { WormholeInstructionCoder } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/coder/instruction";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import type { TransactionInstruction } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import type { PythGovernanceAction } from "../governance_payload";
import { decodeGovernancePayload } from "../governance_payload";
import type { MultisigInstruction } from ".";
import { MultisigInstructionProgram, UNRECOGNIZED_INSTRUCTION } from ".";
import type { AnchorAccounts } from "./anchor";
import { resolveAccountNames } from "./anchor";

export class WormholeMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.WormholeBridge;
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: legacy typing
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;
  readonly governanceAction: PythGovernanceAction | undefined;

  constructor(
    name: string,
    // biome-ignore lint/suspicious/noExplicitAny: legacy typing
    args: { [key: string]: any },
    accounts: AnchorAccounts,
    governanceAction: PythGovernanceAction | undefined,
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
    this.governanceAction = governanceAction;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction,
  ): WormholeMultisigInstruction {
    const wormholeProgram = createReadOnlyWormholeProgramInterface(
      instruction.programId,
      new Connection(getPythClusterApiUrl("devnet")), // Hack to get a decoder, this connection won't actually be used
    );

    const deserializedData = (
      wormholeProgram.coder.instruction as WormholeInstructionCoder
    ).decode(instruction.data);

    if (deserializedData) {
      if (deserializedData.name === "postMessage") {
        const decodedGovernanceAction: PythGovernanceAction | undefined =
          decodeGovernancePayload((deserializedData.data as any).payload);

        return new WormholeMultisigInstruction(
          deserializedData.name,
          deserializedData.data,
          resolveAccountNames(
            wormholeProgram.idl,
            deserializedData.name,
            instruction,
          ),
          decodedGovernanceAction,
        );
      } else {
        return new WormholeMultisigInstruction(
          deserializedData.name,
          deserializedData.data,
          resolveAccountNames(
            wormholeProgram.idl,
            deserializedData.name,
            instruction,
          ),
          undefined,
        );
      }
    } else {
      return new WormholeMultisigInstruction(
        UNRECOGNIZED_INSTRUCTION,
        { data: instruction.data },
        { named: {}, remaining: instruction.keys },
        undefined,
      );
    }
  }
}
