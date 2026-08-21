/** biome-ignore-all lint/suspicious/noConsole: progress output of the CLI scripts that call this */

import { createHash } from "node:crypto";
import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana/index.js";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/index.js";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  CLAIM_RECORD_SEED,
  decodeGovernancePayload,
  EvmExecute,
  ExecutePostedVaa,
  mapKey,
  REMOTE_EXECUTOR_ADDRESS,
} from "@pythnetwork/xc-admin-common";
import type { AccountMeta } from "@solana/web3.js";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import type { PrivateKey, TxResult } from "../../core/base.js";
import { EvmChain, SvmChain } from "../../core/chains.js";
import { EvmExecutorContract } from "../../core/contracts/evm.js";
import type { SvmWormholeContract } from "../../core/contracts/svm.js";
import { DefaultStore } from "./store.js";

// TODO: A better place for this would be `base.ts`. That will require
// significant refactor. Todo in separate PR.
type GovernanceContract = {
  getId(): string;
  getGovernanceDataSource(): Promise<DataSource>;
  getLastExecutedGovernanceSequence(): Promise<number>;
  executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult>;
};

async function executeForGovernanceContract(
  contract: GovernanceContract,
  vaa: Buffer,
  senderPrivateKey: PrivateKey,
) {
  const parsedVaa = parseVaa(vaa);
  const governanceSource = await contract.getGovernanceDataSource();
  if (
    governanceSource.emitterAddress ===
      parsedVaa.emitterAddress.toString("hex") &&
    governanceSource.emitterChain === parsedVaa.emitterChain
  ) {
    const lastExecutedSequence =
      await contract.getLastExecutedGovernanceSequence();
    if (lastExecutedSequence >= parsedVaa.sequence) {
      console.log(
        `Skipping on contract ${contract.getId()} as it was already executed`,
      );
      return;
    }
    const { id } = await contract.executeGovernanceInstruction(
      senderPrivateKey,
      vaa,
    );
    console.log(`Executed on contract ${contract.getId()} with txHash: ${id}`);
  }
}

/**
 * A general executor that tries to find any contract that can execute a given VAA and executes it
 * @param senderPrivateKey - the private key to execute the governance instruction with
 * @param vaa - src/node/utils/executor.tsthe VAA to execute
 */
export async function executeVaa(senderPrivateKey: PrivateKey, vaa: Buffer) {
  const parsedVaa = parseVaa(vaa);
  const action = decodeGovernancePayload(parsedVaa.payload);
  if (!action) return; //TODO: handle other actions

  if (action instanceof ExecutePostedVaa) {
    for (const chain of Object.values(DefaultStore.chains)) {
      if (
        chain instanceof SvmChain &&
        chain.wormholeChainName === action.targetChainId
      ) {
        await executeThroughRemoteExecutor(
          chain,
          senderPrivateKey,
          vaa,
          action,
        );
      }
    }
  } else if (action instanceof EvmExecute) {
    for (const chain of Object.values(DefaultStore.chains)) {
      if (
        chain instanceof EvmChain &&
        chain.wormholeChainName === action.targetChainId
      ) {
        const executorContract = new EvmExecutorContract(
          chain,
          action.executorAddress,
        );

        await executeForGovernanceContract(
          executorContract,
          vaa,
          senderPrivateKey,
        );
      }
    }
  } else {
    for (const contract of Object.values(DefaultStore.contracts)) {
      if (
        action.targetChainId === "unset" ||
        contract.getChain().wormholeChainName === action.targetChainId
      )
        await executeForGovernanceContract(contract, vaa, senderPrivateKey);
    }
  }
}

function findSvmWormholeContract(chain: SvmChain): SvmWormholeContract {
  const contracts = Object.values(DefaultStore.svm_wormhole_contracts).filter(
    (contract) => contract.getChain().getId() === chain.getId(),
  );
  const [contract] = contracts;
  if (!contract || contracts.length > 1) {
    throw new Error(
      `Expected exactly one core bridge for ${chain.getId()}, found ${contracts.length}`,
    );
  }
  return contract;
}

/**
 * Relay an `ExecutePostedVaa` message onto an SVM chain: post the VAA to that chain's core bridge
 * so the guardian signatures are verified on-chain, then have the remote executor replay the
 * instructions it carries, signed by the executor PDA of the emitting vault.
 *
 * Both halves are idempotent, so a partially applied relay can simply be re-run.
 */
async function executeThroughRemoteExecutor(
  chain: SvmChain,
  senderPrivateKey: PrivateKey,
  vaa: Buffer,
  action: ExecutePostedVaa,
) {
  const parsedVaa = parseVaa(vaa);
  const connection = chain.getConnection();
  const payer = chain.getKeypair(senderPrivateKey);
  const emitter = new PublicKey(parsedVaa.emitterAddress);
  const executorKey = mapKey(emitter);
  const claimRecord = PublicKey.findProgramAddressSync(
    [Buffer.from(CLAIM_RECORD_SEED), emitter.toBuffer()],
    REMOTE_EXECUTOR_ADDRESS,
  )[0];

  const claimRecordAccount = await connection.getAccountInfo(claimRecord);
  if (claimRecordAccount) {
    // ClaimRecord is an 8-byte anchor discriminator followed by the last executed sequence.
    const executedSequence = claimRecordAccount.data.readBigUInt64LE(8);
    if (executedSequence >= parsedVaa.sequence) {
      console.log(
        `Skipping on chain ${chain.getId()} as sequence ${parsedVaa.sequence} was already executed`,
      );
      return;
    }
  }

  const wormholeProgramId = findSvmWormholeContract(chain).getProgramId();
  const postedVaa = derivePostedVaaKey(wormholeProgramId, parsedVaa.hash);
  if (await connection.getAccountInfo(postedVaa)) {
    console.log(`VAA is already posted on ${chain.getId()} at ${postedVaa}`);
  } else {
    await postVaaSolana(
      connection,
      signTransactionFactory(payer),
      wormholeProgramId,
      payer.publicKey,
      vaa,
    );
    console.log(`Posted VAA on ${chain.getId()} at ${postedVaa}`);
  }

  // The executor CPIs into each instruction the payload carries, so every account those
  // instructions touch has to ride along as a remaining account — starting with the executor PDA
  // itself, which signs them.
  const remainingAccounts: AccountMeta[] = [
    { isSigner: false, isWritable: true, pubkey: executorKey },
  ];
  for (const instruction of action.instructions) {
    remainingAccounts.push(
      { isSigner: false, isWritable: false, pubkey: instruction.programId },
      ...instruction.keys.filter((key) => !key.pubkey.equals(executorKey)),
    );
  }

  const transaction = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
    .add({
      data: createHash("sha256")
        .update("global:execute_posted_vaa")
        .digest()
        .subarray(0, 8),
      keys: [
        { isSigner: true, isWritable: true, pubkey: payer.publicKey },
        { isSigner: false, isWritable: false, pubkey: postedVaa },
        { isSigner: false, isWritable: true, pubkey: claimRecord },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
        ...remainingAccounts,
      ],
      programId: REMOTE_EXECUTOR_ADDRESS,
    });
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);
  console.log(`Executed on chain ${chain.getId()} with txHash: ${signature}`);
}
