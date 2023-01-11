import { createReadOnlyWormholeProgramInterface } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { WormholeInstructionCoder } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/coder/instruction";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { Connection, TransactionInstruction } from "@solana/web3.js";
import { MultisigInstruction } from ".";
import { decodeGovernancePayload } from "../governance_payload";
import { AnchorAccounts, resolveAccountNames } from "./anchor";

export class WormholeInstruction implements MultisigInstruction {
  readonly program = "Wormhole Bridge";
  readonly name: string;
  readonly args: { [key: string]: any };
  readonly accounts: AnchorAccounts;

  constructor(instruction: TransactionInstruction) {
    const wormholeProgram = createReadOnlyWormholeProgramInterface(
      instruction.programId,
      new Connection(getPythClusterApiUrl("devnet")) // Hack to get a decoder, this connection won't actually be used
    );

    const deserializedData = (
      wormholeProgram.coder.instruction as WormholeInstructionCoder
    ).decode(instruction.data);

    if (deserializedData) {
      this.name = deserializedData.name;
      this.args = deserializedData.data;
      this.accounts = resolveAccountNames(
        wormholeProgram.idl,
        deserializedData.name,
        instruction
      );

      if (this.name === "postMessage") {
        try {
          const decoded = decodeGovernancePayload(this.args.payload);
          this.args.governanceName = decoded.name;
          this.args.governanceArgs = decoded.args;
        } catch {
          this.args.governanceName = "Unrecognized governance message";
          this.args.governanceArgs = {};
        }
      }
    } else {
      this.name = "Unrecognized instruction";
      this.args = {};
      this.accounts = { named: {}, remaining: instruction.keys };
    }
  }
}
