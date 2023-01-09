import Squads, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import {
  PACKET_DATA_SIZE,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  createWormholeProgramInterface,
  getPostMessageAccounts,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { encodeExecutePostedVaa } from "./governance_payload/ExecutePostedVaa";

type SquadInstruction = {
  instruction: TransactionInstruction;
  authorityIndex?: number;
  authorityBump?: number;
  authorityType?: string;
};

/**
 * Propose an array of `TransactionInstructions` as a proposal
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param instructions instructions that will be proposed
 * @param remote whether the instructions should be executed in the chain of the multisig or remotely on Pythnet
 * @returns the newly created proposal's pubkey
 */
export async function proposeInstructions(
  squad: Squads,
  vault: PublicKey,
  instructions: TransactionInstruction[],
  remote: boolean,
  wormholeAddress?: PublicKey
): Promise<PublicKey> {
  const msAccount = await squad.getMultisig(vault);
  let txToSend: Transaction[] = [];

  const createProposal = new Transaction().add(
    await squad.buildCreateTransaction(
      msAccount.publicKey,
      msAccount.authorityIndex,
      msAccount.transactionIndex + 1
    )
  );
  const newProposalAddress = getTxPDA(
    vault,
    new BN(msAccount.transactionIndex + 1),
    squad.multisigProgramId
  )[0];
  txToSend.push(createProposal);

  if (remote) {
    if (!wormholeAddress) {
      throw new Error("Need wormhole address");
    }
    for (let i = 0; i < instructions.length; i++) {
      const squadIx = await wrapAsRemoteInstruction(
        squad,
        vault,
        newProposalAddress,
        instructions[i],
        i,
        wormholeAddress
      );
      txToSend.push(
        new Transaction().add(
          await squad.buildAddInstruction(
            vault,
            newProposalAddress,
            squadIx.instruction,
            i,
            squadIx.authorityIndex,
            squadIx.authorityBump,
            squadIx.authorityType
          )
        )
      );
    }
  } else {
    for (let i = 0; i < instructions.length; i++) {
      txToSend.push(
        new Transaction().add(
          await squad.buildAddInstruction(
            vault,
            newProposalAddress,
            instructions[i],
            i
          )
        )
      );
    }
  }

  txToSend.push(
    new Transaction().add(
      await squad.buildActivateTransaction(vault, newProposalAddress)
    )
  );
  txToSend.push(
    new Transaction().add(
      await squad.buildApproveTransaction(vault, newProposalAddress)
    )
  );

  await new AnchorProvider(
    squad.connection,
    squad.wallet,
    AnchorProvider.defaultOptions()
  ).sendAll(
    txToSend.map((tx) => {
      return { tx, signers: [] };
    })
  );
  return newProposalAddress;
}

export async function wrapAsRemoteInstruction(
  squad: Squads,
  vault: PublicKey,
  proposalAddress: PublicKey,
  instruction: TransactionInstruction,
  instructionIndex: number,
  wormholeAddress: PublicKey
): Promise<SquadInstruction> {
  const [messagePDA, messagePdaBump] = getIxAuthorityPDA(
    proposalAddress,
    new BN(instructionIndex),
    squad.multisigProgramId
  );

  const emitter = squad.getAuthorityPDA(vault, 0);

  const provider = new AnchorProvider(
    squad.connection,
    squad.wallet,
    AnchorProvider.defaultOptions()
  );
  const wormholeProgram = createWormholeProgramInterface(
    wormholeAddress,
    provider
  );
  const buffer = encodeExecutePostedVaa({
    targetChainId: "pythnet",
    instructions: [instruction],
  });

  const accounts = getPostMessageAccounts(
    wormholeAddress,
    emitter,
    emitter,
    messagePDA
  );
  return {
    instruction: await wormholeProgram.methods
      .postMessage(0, buffer, 0)
      .accounts(accounts)
      .instruction(),
    authorityIndex: instructionIndex,
    authorityBump: messagePdaBump,
    authorityType: "custom",
  };
}
