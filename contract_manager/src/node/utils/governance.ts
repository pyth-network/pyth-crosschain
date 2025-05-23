import { readFileSync } from "fs";

import {
  Connection,
  Keypair,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import * as bs58 from "bs58";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import SquadsMesh from "@sqds/mesh";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  executeProposal,
  MultisigVault,
  WORMHOLE_ADDRESS,
  WORMHOLE_API_ENDPOINT,
} from "@pythnetwork/xc-admin-common";
import {
  createWormholeProgramInterface,
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
  deriveWormholeBridgeDataKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { KeyValueConfig, Storable } from "../../core/base";
import { PriorityFeeConfig } from "@pythnetwork/solana-utils";

class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransactionError";
  }
}

// A registry of solana RPC nodes for each cluster.
export type SolanaRpcRegistry = (cluster: PythCluster) => string;

export class SubmittedWormholeMessage {
  constructor(
    public emitter: PublicKey,
    public sequenceNumber: number,
    public cluster: PythCluster,
  ) {}

  /**
   * Attempts to find the emitter and sequence number of a wormhole message from a transaction
   * Parses the transaction and looks for the wormhole postMessage instruction to find the emitter
   * Inspects the transaction logs to find the sequence number
   * @param signature signature of the transaction to inspect
   * @param cluster the cluster the transaction was submitted to
   * @param registry registry of RPC nodes to use for each solana network. Defaults to the Solana public RPCs if not provided.
   */
  static async fromTransactionSignature(
    signature: string,
    cluster: PythCluster,
    registry: SolanaRpcRegistry = getPythClusterApiUrl,
  ): Promise<SubmittedWormholeMessage> {
    const connection = new Connection(registry(cluster), "confirmed");

    const txDetails = await connection.getParsedTransaction(signature);
    const sequenceLogPrefix = "Sequence: ";
    const txLog = txDetails?.meta?.logMessages?.find((s) =>
      s.includes(sequenceLogPrefix),
    );

    const sequenceNumber = Number(
      txLog?.substring(
        txLog.indexOf(sequenceLogPrefix) + sequenceLogPrefix.length,
      ),
    );

    const wormholeAddress = WORMHOLE_ADDRESS[cluster];
    if (!wormholeAddress) throw new Error(`Invalid cluster ${cluster}`);
    let emitter: PublicKey | undefined = undefined;

    let allInstructions: (ParsedInstruction | PartiallyDecodedInstruction)[] =
      txDetails?.transaction?.message?.instructions || [];
    txDetails?.meta?.innerInstructions?.forEach((instruction) => {
      allInstructions = allInstructions.concat(instruction.instructions);
    });
    allInstructions.forEach((instruction) => {
      if (!instruction.programId.equals(wormholeAddress)) return;
      // we assume RPC can not parse wormhole instructions and the type is not ParsedInstruction
      const wormholeInstruction = instruction as PartiallyDecodedInstruction;
      if (bs58.decode(wormholeInstruction.data)[0] !== 1) return; // 1 is wormhole postMessage Instruction discriminator
      emitter = wormholeInstruction.accounts[2];
    });
    if (!emitter)
      throw new InvalidTransactionError(
        "Could not find wormhole postMessage instruction",
      );
    return new SubmittedWormholeMessage(emitter, sequenceNumber, cluster);
  }

  /**
   * Tries to fetch the VAA from the wormhole bridge API waiting for a certain amount of time
   * before giving up and throwing an error
   * @param waitingSeconds how long to wait before giving up
   */
  async fetchVaa(waitingSeconds = 1): Promise<Buffer> {
    const rpcUrl = WORMHOLE_API_ENDPOINT[this.cluster];

    const startTime = Date.now();
    while (Date.now() - startTime < waitingSeconds * 1000) {
      const response = await fetch(
        `${rpcUrl}/v1/signed_vaa/1/${this.emitter.toBuffer().toString("hex")}/${
          this.sequenceNumber
        }`,
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

function asPythCluster(cluster: string): PythCluster {
  const pythCluster = cluster as PythCluster;
  getPythClusterApiUrl(pythCluster); // throws if cluster is invalid
  return pythCluster;
}

/**
 * A simple emitter that can send messages to the wormhole bridge
 * This can be used instead of multisig as a simple way to send messages
 * and debug contracts deployed on testing networks
 * You need to set your pyth contract data source / governance source address to this emitter
 */
export class WormholeEmitter {
  cluster: PythCluster;
  wallet: Wallet;

  constructor(cluster: string, wallet: Wallet) {
    this.wallet = wallet;
    this.cluster = asPythCluster(cluster);
  }

  public getEmitter() {
    return this.wallet.publicKey;
  }

  /**
   * Send a wormhole message containing payload through wormhole.
   * @param payload the contents of the message
   * @param registry registry of RPC nodes to use for each solana network. Defaults to the Solana public RPCs if not provided.
   */
  async sendMessage(
    payload: Buffer,
    registry: SolanaRpcRegistry = getPythClusterApiUrl,
  ) {
    const provider = new AnchorProvider(
      new Connection(registry(this.cluster), "confirmed"),
      this.wallet,
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      },
    );
    const wormholeAddress = WORMHOLE_ADDRESS[this.cluster];
    if (!wormholeAddress) throw new Error(`Invalid cluster ${this.cluster}`);
    const kp = Keypair.generate();
    const feeCollector = deriveFeeCollectorKey(wormholeAddress);
    const emitter = this.wallet.publicKey;
    const accounts = {
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
      provider,
    );
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: emitter,
        toPubkey: feeCollector,
        lamports: 1000,
      }),
    );
    transaction.add(
      await wormholeProgram.methods
        .postMessage(0, payload, 0)
        .accounts(accounts)
        .instruction(),
    );
    const signature = await provider.sendAndConfirm(transaction, [kp]);
    return SubmittedWormholeMessage.fromTransactionSignature(
      signature,
      this.cluster,
    );
  }
}

export class WormholeMultisigProposal {
  constructor(
    public address: PublicKey,
    public squad: SquadsMesh,
    public cluster: PythCluster,
  ) {}

  /**
   * Gets the current state of the proposal which can be "active", "draft", "executed", etc.
   */
  async getState() {
    const proposal = await this.squad.getTransaction(this.address);
    // Converts the status object to a string e.g
    // { "active":{} } => "active"
    return Object.keys(proposal.status)[0];
  }

  /**
   * Executes the proposal and returns the wormhole messages that were sent
   * The proposal must be already approved.
   */
  async execute(): Promise<SubmittedWormholeMessage[]> {
    const proposal = await this.squad.getTransaction(this.address);
    const signatures = await executeProposal(
      proposal,
      this.squad,
      this.cluster,
      this.squad.connection.commitment,
      {},
    );
    const msgs: SubmittedWormholeMessage[] = [];
    for (const signature of signatures) {
      try {
        msgs.push(
          await SubmittedWormholeMessage.fromTransactionSignature(
            signature,
            this.cluster,
          ),
        );
      } catch (e) {
        if (!(e instanceof InvalidTransactionError)) throw e;
      }
    }
    if (msgs.length > 0) return msgs;
    throw new Error("No transactions with wormhole messages found");
  }
}

/**
 * A vault represents a pyth multisig governance realm which exists in solana mainnet or testnet.
 * It can be used for proposals to send wormhole messages to the wormhole bridge.
 */
export class Vault extends Storable {
  static type = "vault";
  key: PublicKey;
  squad?: SquadsMesh;
  cluster: PythCluster;

  constructor(key: string, cluster: string) {
    super();
    this.key = new PublicKey(key);
    this.cluster = asPythCluster(cluster);
  }

  getType(): string {
    return Vault.type;
  }

  static fromJson(parsed: {
    type: string;
    key: string;
    cluster: string;
  }): Vault {
    if (parsed.type !== Vault.type) throw new Error("Invalid type");
    return new Vault(parsed.key, parsed.cluster);
  }

  getId(): string {
    return `${this.cluster}_${this.key.toString()}`;
  }

  toJson(): KeyValueConfig {
    return {
      key: this.key.toString(),
      cluster: this.cluster,
      type: Vault.type,
    };
  }

  /**
   * Connects the vault to a wallet that can be used to submit proposals
   * The wallet should be a multisig signer of the vault
   * @param wallet
   * @param registry registry of RPC nodes to use for each solana network. Defaults to the Solana public RPCs if not provided.
   */
  public connect(
    wallet: Wallet,
    registry: SolanaRpcRegistry = getPythClusterApiUrl,
  ): void {
    this.squad = SquadsMesh.endpoint(registry(this.cluster), wallet);
  }

  getSquadOrThrow(): SquadsMesh {
    if (!this.squad) throw new Error("Please connect a wallet to the vault");
    return this.squad;
  }

  /**
   * Gets the emitter address of the vault
   * @param registry registry of RPC nodes to use for each solana network. Defaults to the Solana public RPCs if not provided.
   */
  public async getEmitter(registry: SolanaRpcRegistry = getPythClusterApiUrl) {
    const squad = SquadsMesh.endpoint(
      registry(this.cluster),
      new NodeWallet(Keypair.generate()), // dummy wallet
    );
    return squad.getAuthorityPDA(this.key, 1);
  }

  /**
   * Gets the last sequence number of the vault emitter
   * This is used to determine the sequence number of the next wormhole message
   * Fetches the sequence number from the wormholescan API
   * @returns the last sequence number
   */
  public async getLastSequenceNumber(): Promise<number> {
    const rpcUrl = WORMHOLE_API_ENDPOINT[this.cluster];
    const emitter = await this.getEmitter();
    const response = await fetch(
      `${rpcUrl}/api/v1/vaas/1/${emitter.toBase58()}`,
    );
    const { data } = await response.json();
    return data[0].sequence;
  }

  /**
   * Proposes sending an array of wormhole messages to the wormhole bridge
   * Requires a wallet to be connected to the vault
   *
   * @param payloads the payloads to send to the wormhole bridge
   * @param proposalAddress if specified, will continue an existing proposal
   */
  public async proposeWormholeMessage(
    payloads: Buffer[],
    proposalAddress?: PublicKey,
    priorityFeeConfig: PriorityFeeConfig = {},
  ): Promise<WormholeMultisigProposal> {
    const squad = this.getSquadOrThrow();
    const multisigVault = new MultisigVault(
      squad.wallet as Wallet,
      this.cluster,
      squad,
      this.key,
    );
    const txAccount =
      await multisigVault.proposeWormholeMultipleMessagesWithPayer(
        payloads,
        squad.wallet.publicKey,
        proposalAddress,
        priorityFeeConfig,
      );
    return new WormholeMultisigProposal(txAccount, squad, this.cluster);
  }
}

/**
 * Loads a solana wallet from a file. The file should contain the secret key in array of integers format
 * This wallet can be used to connect to a vault and submit proposals
 * @param walletPath path to the wallet file
 */
export async function loadHotWallet(walletPath: string): Promise<Wallet> {
  return new NodeWallet(
    Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(walletPath, "ascii"))),
    ),
  );
}
