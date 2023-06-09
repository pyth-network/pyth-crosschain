import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import SquadsMesh, { getIxAuthorityPDA, getTxPDA } from "@sqds/mesh";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  batchIntoExecutorPayload,
  MAX_INSTRUCTIONS_PER_PROPOSAL,
  wrapAsRemoteInstruction,
} from "./propose";
import { MultisigAccount } from "@sqds/mesh/lib/types";
import { BN } from "bn.js";

export class PythContracts {
  constructor() {
    this.multisig = multisig;
  }

  public async oracleContract(cluster?: PythCluster): Promise<OracleContract> {}

  public async messageBufferContract(
    cluster?: PythCluster
  ): Promise<MessageBufferContract> {}

  public async cosmosContract(
    chainId: number
  ): Promise<MessageBufferContract> {}
}

export class OracleContract {
  // Put getters here that

  public async updater(): Promise<OracleContractUpdater>;
}

export class OracleContractUpdater {
  private builder: IBuilder;

  public async addPublisher() {
    // builder.addInstruction()
  }

  public async initPrice() {
    // builder.addInstruction()
  }
}

export class CosmosTxBuilder {
  private builder: IAuthorizedBuilder;
  private wormholeAddress: PublicKey;

  public async addSetFee() {
    // make wh governance payload,
    this.builder.addInstructionWithAuthority(async (authority) => {
      return await getPostMessageInstruction(
        builder.admin,
        authority,
        wormholeAddress,
        payload
      );
    });
  }
}

class TokenAccountTxBuilder implements TxBuilder {
  private admin: PythMultisig;

  // Tokens will be sent from this account / cluster.
  private fromPubkey: PublicKey;

  private instructions: TransactionInstruction[];

  private wrapper: TxWrapper;

  constructor(admin: PythMultisig) {
    this.admin = admin;
    this.instructions = [];
  }

  // TODO: this needs to be a bignumber
  public transferSol(qtyLamports: number, to: PublicKey) {
    const proposalInstruction: TransactionInstruction = SystemProgram.transfer({
      fromPubkey: this.fromPubkey,
      toPubkey: to,
      lamports: qtyLamports,
    });

    this.instructions.push(proposalInstruction);
  }

  public build(): TransactionInstruction[] {
    return this.wrapper.wrap(this.instructions);
  }
}
