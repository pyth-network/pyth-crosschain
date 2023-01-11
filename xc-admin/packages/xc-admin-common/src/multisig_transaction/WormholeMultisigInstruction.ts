import { createReadOnlyWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { WormholeInstructionCoder } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/coder/instruction";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { Connection, TransactionInstruction } from "@solana/web3.js";
import { MultisigInstruction, MultisigInstructionProgram } from ".";
import { decodeGovernancePayload } from "../governance_payload";
import { AnchorAccounts, resolveAccountNames } from "./anchor";

export class WormholeMultisigInstruction implements MultisigInstruction {
  readonly program = MultisigInstructionProgram.WormholeBridge;
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(
    name: string,
    args: { [key: string]: any },
    accounts: AnchorAccounts
  ) {
    this.name = name;
    this.args = args;
    this.accounts = accounts;
  }

  static fromTransactionInstruction(
    instruction: TransactionInstruction
  ): WormholeMultisigInstruction {
    const wormholeProgram = createReadOnlyWormholeProgramInterface(
      instruction.programId,
      new Connection(getPythClusterApiUrl("devnet")) // Hack to get a decoder, this connection won't actually be used
    );

    const deserializedData = (
      wormholeProgram.coder.instruction as WormholeInstructionCoder
    ).decode(instruction.data);

    if (deserializedData) {
      let result = new WormholeMultisigInstruction(
        deserializedData.name,
        deserializedData.data,
        resolveAccountNames(
          wormholeProgram.idl,
          deserializedData.name,
          instruction
        )
      );

      if (result.name === "postMessage") {
        try {
          const decoded = decodeGovernancePayload(result.args.payload);
          result.args.governanceName = decoded.name;
          result.args.governanceArgs = decoded.args;
        } catch {
          result.args.governanceName = "Unrecognized governance message";
          result.args.governanceArgs = {};
        }
      }
      return result;
    } else {
      return new WormholeMultisigInstruction(
        "Unrecognized instruction",
        {},
        { named: {}, remaining: instruction.keys }
      );
    }
  }
}
