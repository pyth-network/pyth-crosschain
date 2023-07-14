import { ChainId } from "../chains";
import { ethers } from "ethers";
import { PythGovernanceAction } from "../governance_payload";

export enum ContractType {
  Oracle,
  EvmPythUpgradable,
  EvmWormholeReceiver,
}

/**
 * A unique identifier for a blockchain. Note that we cannot use ChainId for this, as ChainId currently reuses
 * some ids across mainnet / testnet chains (e.g., ethereum goerli has the same id as ethereum mainnet).
 */
export type NetworkId = string;

/** A unique identifier for message senders across all wormhole networks. */
export interface WormholeAddress {
  emitter: string;
  chainId: ChainId;
  // which network this sender is on
  network: WormholeNetwork;
}
export type WormholeNetwork = "mainnet" | "testnet";

/**
 * A Contract is the basic unit of on-chain state that is managed by xc_admin.
 * Each contracts lives at a specific address of a specific network, and has a type
 * representing which of several known contract types (evm target chain, wormhole receiver, etc)
 * that it is.
 *
 * Contracts further expose a state representing values that can be modified by governance.
 * The fields of the state object vary depending on what type of contract this is.
 * Finally, contracts expose a sync method that generates the needed operations to bring the on-chain state
 * in sync with a provided desired state.
 */
export interface Contract<State> {
  type: ContractType;
  networkId: NetworkId;
  /** The address of the contract. The address may be written in different formats for different networks. */
  getAddress(): string;

  /** Get the on-chain state of all governance-controllable fields of this contract. */
  getState(): Promise<State>;

  /** Generate a set of operations that, if executed, will update the on-chain contract state to be `target`. */
  sync(target: State): Promise<SyncOp[]>;
}

/**
 * An idempotent synchronization operation to update on-chain state. The operation may depend on
 * external approvals or actions to complete, in which case the operation will pause and need to
 * be resumed later.
 */
export interface SyncOp {
  /**
   * A unique identifier for this operation. The id represents the content of the operation (e.g., "sets the X
   * field to Y on contract Z"), so can be used to identify the "same" operation across multiple runs of this program.
   */
  id(): string;
  /**
   * Run this operation from a previous state (recorded in cache). The operation can modify cache
   * to record progress, then returns true if the operation has completed. If this function returns false,
   * it is waiting on an external operation to complete (e.g., a multisig transaction to be approved).
   * Re-run this function again once that operation is completed to continue making progress.
   *
   * The caller of this function is responsible for preserving the contents of `cache` between calls to
   * this function.
   */
  run(cache: Record<string, any>): Promise<boolean>;
}

export class SendGovernanceInstruction implements SyncOp {
  private instruction: PythGovernanceAction;
  private sender: WormholeAddress;
  // function to submit the signed VAA to the target chain contract
  private submitVaa: (vaa: string) => Promise<boolean>;

  constructor(
    instruction: PythGovernanceAction,
    from: WormholeAddress,
    submitVaa: (vaa: string) => Promise<boolean>
  ) {
    this.instruction = instruction;
    this.sender = from;
    this.submitVaa = submitVaa;
  }

  public id(): string {
    // TODO: use a more understandable identifier (also this may not be unique)
    return ethers.utils.sha256(this.instruction.encode());
  }

  public async run(cache: Record<string, any>): Promise<boolean> {
    // FIXME: this implementation is temporary. replace with something like the commented out code below.
    if (cache["multisigTx"] === undefined) {
      cache["multisigTx"] = "fooooo";
      return false;
    }

    if (cache["vaa"] === undefined) {
      return false;
    }

    // VAA is guaranteed to be defined here
    const vaa = cache["vaa"];

    // assertVaaPayloadEquals(vaa, payload);

    return await this.submitVaa(vaa);
  }

  /*
  public async run(cache: Record<string,any>): Promise<boolean> {
    if (cache["multisigTx"] === undefined) {
      // Have not yet submitted this operation to the multisig.
      const payload = this.instruction.serialize();
      const txKey = vault.sendWormholeInstruction(payload);
      cache["multisigTx"] = txKey;
      return false;
    }

    if (cache["vaa"] === undefined) {
      const vaa = await executeMultisigTxAndGetVaa(txKey, payloadHex);
      if (vaa === undefined) {
        return false;
      }
      cache["vaa"] = vaa;
    }

    // VAA is guaranteed to be defined here
    const vaa = cache["vaa"];

    assertVaaPayloadEquals(vaa, payload);

    // await proxy.executeGovernanceInstruction("0x" + vaa);
    await submitVaa(vaa);
  }
   */
}
