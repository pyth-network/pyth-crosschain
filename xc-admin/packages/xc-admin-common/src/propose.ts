import Squads, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import {
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
            i + 1,
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
            i + 1
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

  console.log(txToSend);

  await new AnchorProvider(squad.connection, squad.wallet, {
    skipPreflight: true,
  }).sendAll(
    txToSend.map((tx) => {
      return { tx, signers: [] };
    })
  );
  return newProposalAddress;
}

/**
 * Wrap `instruction` in a Wormhole message for remote execution
 * @param squad Squads client
 * @param vault vault public key (the id of the multisig where these instructions should be proposed)
 * @param proposalAddress address of the proposal
 * @param instruction instruction to be wrapped in a Wormhole message
 * @param instructionIndex index of the instruction within the proposal
 * @param wormholeAddress address of the Wormhole bridge
 * @returns an instruction to be proposed
 */
export async function wrapAsRemoteInstruction(
  squad: Squads,
  vault: PublicKey,
  proposalAddress: PublicKey,
  instruction: TransactionInstruction,
  instructionIndex: number,
  wormholeAddress: PublicKey
): Promise<SquadInstruction> {
  const emitter = squad.getAuthorityPDA(vault, 0);

  const [messagePDA, messagePdaBump] = getIxAuthorityPDA(
    proposalAddress,
    new BN(instructionIndex),
    squad.multisigProgramId
  );

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
