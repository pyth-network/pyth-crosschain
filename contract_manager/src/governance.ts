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
import { AnchorProvider, Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  decodeGovernancePayload,
  executeProposal,
  MultisigVault,
  WORMHOLE_ADDRESS,
  WORMHOLE_API_ENDPOINT,
} from "xc_admin_common";
import {
  createWormholeProgramInterface,
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
  deriveWormholeBridgeDataKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { Storable } from "./base";
import { parseVaa } from "@certusone/wormhole-sdk";
import { DefaultStore } from "./store";

class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransactionError";
  }
}

export class SubmittedWormholeMessage {
  constructor(
    public emitter: PublicKey,
    public sequenceNumber: number,
    public cluster: PythCluster
  ) {}

  /**
   * Attempts to find the emitter and sequence number of a wormhole message from a transaction
   * Parses the transaction and looks for the wormhole postMessage instruction to find the emitter
   * Inspects the transaction logs to find the sequence number
   * @param signature signature of the transaction to inspect
   * @param cluster the cluster the transaction was submitted to
   */
  static async fromTransactionSignature(
    signature: string,
    cluster: PythCluster
  ): Promise<SubmittedWormholeMessage> {
    const connection = new Connection(
      getPythClusterApiUrl(cluster),
      "confirmed"
    );

    const txDetails = await connection.getParsedTransaction(signature);
    const sequenceLogPrefix = "Sequence: ";
    const txLog = txDetails?.meta?.logMessages?.find((s) =>
      s.includes(sequenceLogPrefix)
    );

    const sequenceNumber = Number(
      txLog?.substring(
        txLog.indexOf(sequenceLogPrefix) + sequenceLogPrefix.length
      )
    );

    const wormholeAddress =
      WORMHOLE_ADDRESS[cluster as keyof typeof WORMHOLE_ADDRESS]!;
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
        "Could not find wormhole postMessage instruction"
      );
    return new SubmittedWormholeMessage(emitter, sequenceNumber, cluster);
  }

  /**
   * Tries to fetch the VAA from the wormhole bridge API waiting for a certain amount of time
   * before giving up and throwing an error
   * @param waitingSeconds how long to wait before giving up
   */
  async fetchVaa(waitingSeconds: number = 1): Promise<Buffer> {
    let rpcUrl = WORMHOLE_API_ENDPOINT[this.cluster];

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
 * A general executor that tries to find any contract that can execute a given VAA and executes it
 * @param senderPrivateKey the private key to execute the governance instruction with
 * @param vaa the VAA to execute
 */
export async function executeVaa(senderPrivateKey: string, vaa: Buffer) {
  const parsedVaa = parseVaa(vaa);
  const action = decodeGovernancePayload(parsedVaa.payload);
  if (!action) return; //TODO: handle other actions
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (
      action.targetChainId === "unset" ||
      contract.getChain().wormholeChainName === action.targetChainId
    ) {
      const governanceSource = await contract.getGovernanceDataSource();
      if (
        governanceSource.emitterAddress ===
          parsedVaa.emitterAddress.toString("hex") &&
        governanceSource.emitterChain === parsedVaa.emitterChain
      ) {
        // TODO: check governance sequence number as well
        await contract.executeGovernanceInstruction(senderPrivateKey, vaa);
      }
    }
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

  async sendMessage(payload: Buffer) {
    const provider = new AnchorProvider(
      new Connection(getPythClusterApiUrl(this.cluster), "confirmed"),
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
    const signature = await provider.sendAndConfirm(transaction, [kp]);
    return SubmittedWormholeMessage.fromTransactionSignature(
      signature,
      this.cluster
    );
  }
}

export class WormholeMultiSigTransaction {
  constructor(
    public address: PublicKey,
    public squad: SquadsMesh,
    public cluster: PythCluster
  ) {}

  async getState() {
    const proposal = await this.squad.getTransaction(this.address);
    // Converts the status object to a string e.g
    // { "active":{} } => "active"
    return Object.keys(proposal.status)[0];
  }

  async execute(): Promise<SubmittedWormholeMessage[]> {
    const proposal = await this.squad.getTransaction(this.address);
    const signatures = await executeProposal(
      proposal,
      this.squad,
      this.cluster
    );
    const msgs: SubmittedWormholeMessage[] = [];
    for (const signature of signatures) {
      try {
        msgs.push(
          await SubmittedWormholeMessage.fromTransactionSignature(
            signature,
            this.cluster
          )
        );
      } catch (e: any) {
        if (!(e instanceof InvalidTransactionError)) throw e;
      }
    }
    if (msgs.length > 0) return msgs;
    throw new Error("No transactions with wormhole messages found");
  }
}

export class Vault extends Storable {
  static type: string = "vault";
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

  static fromJson(parsed: any): Vault {
    if (parsed.type !== Vault.type) throw new Error("Invalid type");
    return new Vault(parsed.key, parsed.cluster);
  }

  getId(): string {
    return `${this.cluster}_${this.key.toString()}`;
  }

  toJson(): any {
    return {
      key: this.key.toString(),
      cluster: this.cluster,
      type: Vault.type,
    };
  }

  public connect(wallet: Wallet): void {
    this.squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(this.cluster),
      wallet
    );
  }

  getSquadOrThrow(): SquadsMesh {
    if (!this.squad) throw new Error("Please connect a wallet to the vault");
    return this.squad;
  }

  public async getEmitter() {
    const squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(this.cluster),
      new NodeWallet(Keypair.generate()) // dummy wallet
    );
    return squad.getAuthorityPDA(this.key, 1);
  }

  public async proposeWormholeMessage(
    payloads: Buffer[],
    proposalAddress?: PublicKey
  ): Promise<WormholeMultiSigTransaction> {
    const squad = this.getSquadOrThrow();
    const multisigVault = new MultisigVault(
      squad.wallet,
      this.cluster,
      squad,
      this.key
    );
    const txAccount =
      await multisigVault.proposeWormholeMultipleMessagesWithPayer(
        payloads,
        squad.wallet.publicKey,
        proposalAddress
      );
    return new WormholeMultiSigTransaction(txAccount, squad, this.cluster);
  }
}

export async function loadHotWallet(wallet: string): Promise<Wallet> {
  return new NodeWallet(
    Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(wallet, "ascii")))
    )
  );
}
