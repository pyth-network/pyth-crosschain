/* eslint-disable no-console */
import { parseVaa } from "@certusone/wormhole-sdk";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  EvmExecute,
  decodeGovernancePayload,
} from "@pythnetwork/xc-admin-common";

import { DefaultStore } from "./store.js";
import type { PrivateKey, TxResult } from "../../core/base.js";
import { EvmChain } from "../../core/chains.js";
import { EvmExecutorContract } from "../../core/contracts/evm.js";

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

  if (action instanceof EvmExecute) {
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
