import { readFileSync } from "fs";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { BN } from "bn.js";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import SquadsMesh, { getTxPDA } from "@sqds/mesh";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { WORMHOLE_ADDRESS, WORMHOLE_API_ENDPOINT } from "xc_admin_common";
import {
  createWormholeProgramInterface,
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
  deriveWormholeBridgeDataKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { Contract, Storable } from "./base";

export const Contracts: Record<string, Contract> = {};

export class SubmittedWormholeMessage {
  constructor(
    public emitter: PublicKey,
    public sequenceNumber: number,
    public cluster: string
  ) {}

  /**
   * Tries to fetch the VAA from the wormhole bridge API waiting for a certain amount of time
   * before giving up and throwing an error
   * @param waitingSeconds how long to wait before giving up
   */
  async fetchVAA(waitingSeconds: number = 1): Promise<Buffer> {
    let rpcUrl =
      WORMHOLE_API_ENDPOINT[this.cluster as keyof typeof WORMHOLE_API_ENDPOINT];

    let startTime = Date.now();
    while (Date.now() - startTime < waitingSeconds * 1000) {
      const response = await fetch(
        `${rpcUrl}/v1/signed_vaa/1/${this.emitter.toBuffer().toString("hex")}/${
          this.sequenceNumber
        }`
      );
      if (response.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      const { vaaBytes } = await response.json();
      return Buffer.from(vaaBytes, "base64");
    }
    throw new Error("VAA not found, maybe too soon to fetch?");
  }
}

/**
 * A simple emitter that can send messages to the wormhole bridge
 * This can be used instead of multisig as a simple way to send messages
 * and debug contracts deployed on testing networks
 * You need to set your pyth contract data source / governance source address to this emitter
 */
export class WormholeEmitter {
  cluster: string;
  wallet: Wallet;

  constructor(cluster: string, wallet: Wallet) {
    this.cluster = cluster;
    this.wallet = wallet;
  }

  async sendMessage(payload: Buffer) {
    const provider = new AnchorProvider(
      new Connection(getPythClusterApiUrl(this.cluster as any), "confirmed"),
      this.wallet,
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );
    let wormholeAddress =
      WORMHOLE_ADDRESS[this.cluster as keyof typeof WORMHOLE_ADDRESS]!;
    let kp = Keypair.generate();
    let feeCollector = deriveFeeCollectorKey(wormholeAddress);
    let emitter = this.wallet.publicKey;
    let accounts = {
      bridge: deriveWormholeBridgeDataKey(wormholeAddress),
      message: kp.publicKey,
      emitter: emitter,
      sequence: deriveEmitterSequenceKey(emitter, wormholeAddress),
      payer: emitter,
      feeCollector,
      clock: SYSVAR_CLOCK_PUBKEY,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
    };
    const wormholeProgram = createWormholeProgramInterface(
      wormholeAddress,
      provider
    );
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: emitter,
        toPubkey: feeCollector,
        lamports: 1000,
      })
    );
    transaction.add(
      await wormholeProgram.methods
        .postMessage(0, payload, 0)
        .accounts(accounts)
        .instruction()
    );
    const txSig = await provider.sendAndConfirm(transaction, [kp]);
    const txDetails = await provider.connection.getParsedTransaction(txSig);
    const sequenceLogPrefix = "Sequence: ";
    const txLog = txDetails?.meta?.logMessages?.find((s) =>
      s.includes(sequenceLogPrefix)
    );

    const sequenceNumber = Number(
      txLog?.substring(
        txLog.indexOf(sequenceLogPrefix) + sequenceLogPrefix.length
      )
    );
    return new SubmittedWormholeMessage(emitter, sequenceNumber, this.cluster);
  }
}

export class Vault extends Storable {
  static type: string = "vault";
  key: PublicKey;
  squad?: SquadsMesh;
  cluster: string;

  constructor(key: string, cluster: string) {
    super();
    this.key = new PublicKey(key);
    this.cluster = cluster;
  }

  getType(): string {
    return Vault.type;
  }

  static from(path: string): Vault {
    let parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (parsed.type !== Vault.type) throw new Error("Invalid type");
    return new Vault(parsed.key, parsed.cluster);
  }

  getId(): string {
    return `${this.cluster}_${this.key.toString()}`;
  }

  toJSON(): any {
    return {
      key: this.key.toString(),
      cluster: this.cluster,
      type: Vault.type,
    };
  }

  public connect(wallet: Wallet): void {
    this.squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(this.cluster as any), // TODO Fix any
      wallet
    );
  }

  public async createProposalIx(
    proposalIndex: number
  ): Promise<[TransactionInstruction, PublicKey]> {
    const squad = this.getSquadOrThrow();
    const msAccount = await squad.getMultisig(this.key);

    const ix = await squad.buildCreateTransaction(
      msAccount.publicKey,
      msAccount.authorityIndex,
      proposalIndex
    );

    const newProposalAddress = getTxPDA(
      this.key,
      new BN(proposalIndex),
      squad.multisigProgramId
    )[0];

    return [ix, newProposalAddress];
  }

  public async activateProposalIx(
    proposalAddress: PublicKey
  ): Promise<TransactionInstruction> {
    const squad = this.getSquadOrThrow();
    return await squad.buildActivateTransaction(this.key, proposalAddress);
  }

  public async approveProposalIx(
    proposalAddress: PublicKey
  ): Promise<TransactionInstruction> {
    const squad = this.getSquadOrThrow();
    return await squad.buildApproveTransaction(this.key, proposalAddress);
  }

  getSquadOrThrow(): SquadsMesh {
    if (!this.squad) throw new Error("Please connect a wallet to the vault");
    return this.squad;
  }

  public async proposeWormholeMessage(payload: Buffer): Promise<any> {
    const squad = this.getSquadOrThrow();
    const msAccount = await squad.getMultisig(this.key);

    let ixToSend: TransactionInstruction[] = [];
    const [proposalIx, newProposalAddress] = await this.createProposalIx(
      msAccount.transactionIndex + 1
    );

    const proposalIndex = msAccount.transactionIndex + 1;
    ixToSend.push(proposalIx);
    return ixToSend;
    // const instructionToPropose = await getPostMessageInstruction(
    //     squad,
    //     this.key,
    //     newProposalAddress,
    //     1,
    //     this.wormholeAddress()!,
    //     payload
    // );
    // ixToSend.push(
    //     await squad.buildAddInstruction(
    //         this.key,
    //         newProposalAddress,
    //         instructionToPropose.instruction,
    //         1,
    //         instructionToPropose.authorityIndex,
    //         instructionToPropose.authorityBump,
    //         instructionToPropose.authorityType
    //     )
    // );
    // ixToSend.push(await this.activateProposalIx(newProposalAddress));
    // ixToSend.push(await this.approveProposalIx(newProposalAddress));

    // const txToSend = batchIntoTransactions(ixToSend);
    // for (let i = 0; i < txToSend.length; i += SIZE_OF_SIGNED_BATCH) {
    //     await this.getAnchorProvider().sendAll(
    //         txToSend.slice(i, i + SIZE_OF_SIGNED_BATCH).map((tx) => {
    //             return { tx, signers: [] };
    //         })
    //     );
    // }
    // return newProposalAddress;
  }
}

export const Vaults: Record<string, Vault> = {};

export async function loadHotWallet(wallet: string): Promise<Wallet> {
  return new NodeWallet(
    Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(wallet, "ascii")))
    )
  );
}
