/** biome-ignore-all lint/suspicious/noConsole: progress output of the CLI scripts that call this */

import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana/index.js";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/index.js";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  CLAIM_RECORD_SEED,
  decodeGovernancePayload,
  EvmExecute,
  ExecutePostedVaa,
  getRemoteExecutorProgram,
  mapKey,
  REMOTE_EXECUTOR_ADDRESS,
} from "@pythnetwork/xc-admin-common";
import type { AccountMeta } from "@solana/web3.js";
import {
  ComputeBudgetProgram,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
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

  const program = getRemoteExecutorProgram(connection);
  const claimRecordAccount = await connection.getAccountInfo(claimRecord);
  if (claimRecordAccount) {
    // The anchor this IDL is built with camel-cases `program.account` at runtime but not at the
    // type level, so the coder is the only way to reach a PascalCase account.
    const { sequence } = program.coder.accounts.decode<{ sequence: BN }>(
      "ClaimRecord",
      claimRecordAccount.data,
    );
    if (sequence.gte(new BN(parsedVaa.sequence.toString()))) {
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

  // Every account the CPI'd instructions touch has to ride along, led by the signing PDA.
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
    .add(
      await program.methods
        .executePostedVaa()
        .accounts({ claimRecord, payer: payer.publicKey, postedVaa })
        .remainingAccounts(remainingAccounts)
        .instruction(),
    );
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);
  console.log(`Executed on chain ${chain.getId()} with txHash: ${signature}`);
}
