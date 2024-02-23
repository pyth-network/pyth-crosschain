import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PythSolanaReceiver } from "./idl/pyth_solana_receiver";
import Idl from "./idl/pyth_solana_receiver.json";
import {
  WormholeCoreBridgeSolana,
  IDL as WormholeCoreBridgeSolanaIdl,
} from "./idl/wormhole_core_bridge_solana";
import {
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  getConfigPda,
  getGuardianSetPda,
  getTreasuryPda,
} from "./address";
import { PublicKey, Keypair } from "@solana/web3.js";
import { parseAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { DEFAULT_TREASURY_ID, VAA_SPLIT_INDEX, VAA_START } from "./constants";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { getGuardianSetIndex } from "./vaa";

export class TransactionBuilder {
  private transactionInstructions: {
    instructions: TransactionInstruction[];
    signers: Signer[];
  }[] = [];
  private pythSolanaReceiverConnection: PythSolanaReceiverConnection;
  private encodedVaaAddress: PublicKey | undefined;
  private priceUpdateAddress: PublicKey | undefined;

  constructor(pythSolanaReceiverConnection: PythSolanaReceiverConnection) {
    this.pythSolanaReceiverConnection = pythSolanaReceiverConnection;
  }

  async addPostPriceUpdate(vaa: string) {
    const { transactions, priceUpdateAddress, encodedVaaAddress } =
      await this.pythSolanaReceiverConnection.buildPostPriceUpdateInstructions(
        vaa
      );
    this.encodedVaaAddress = encodedVaaAddress;
    this.priceUpdateAddress = priceUpdateAddress;
    this.transactionInstructions.push(...transactions);
  }

  async addArbitraryInstruction(
    instruction: (
      priceUpdateAddress: PublicKey
    ) => Promise<TransactionInstruction>,
    signers: Signer[]
  ) {
    if (this.priceUpdateAddress === undefined) {
      throw new Error(
        "You need to call addPostPriceUpdate before calling addArbitraryInstruction"
      );
    }
    this.transactionInstructions[
      this.transactionInstructions.length - 1
    ].instructions.push(await instruction(this.priceUpdateAddress));
    this.transactionInstructions[
      this.transactionInstructions.length - 1
    ].signers.push(...signers);
  }

  async getTransactions(): Promise<
    { tx: VersionedTransaction; signers: Signer[] }[]
  > {
    const blockhash = (
      await this.pythSolanaReceiverConnection.connection.getLatestBlockhash()
    ).blockhash;
    return this.transactionInstructions.map(({ instructions, signers }) => {
      return {
        tx: new VersionedTransaction(
          new TransactionMessage({
            recentBlockhash: blockhash,
            instructions: instructions,
            payerKey: this.pythSolanaReceiverConnection.wallet.publicKey,
          }).compileToV0Message()
        ),
        signers: signers,
      };
    });
  }
}

export class PythSolanaReceiverConnection {
  readonly connection: Connection;
  readonly wallet: Wallet;
  private readonly provider: AnchorProvider;
  readonly receiver: Program<PythSolanaReceiver>;
  readonly wormhole: Program<WormholeCoreBridgeSolana>;

  constructor({
    connection,
    wallet,
  }: {
    connection: Connection;
    wallet: Wallet;
  }) {
    this.connection = connection;
    this.wallet = wallet;
    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: "processed",
    }); // TO DO make this configurable
    this.receiver = new Program<PythSolanaReceiver>(
      Idl as PythSolanaReceiver,
      DEFAULT_RECEIVER_PROGRAM_ID,
      this.provider
    );
    this.wormhole = new Program<WormholeCoreBridgeSolana>(
      WormholeCoreBridgeSolanaIdl as WormholeCoreBridgeSolana,
      DEFAULT_WORMHOLE_PROGRAM_ID,
      this.provider
    );
  }

  public getBuilder(): TransactionBuilder {
    return new TransactionBuilder(this);
  }

  async buildPostPriceUpdateInstructions(vaa: string): Promise<{
    transactions: {
      instructions: TransactionInstruction[];
      signers: Signer[];
    }[];
    priceUpdateAddress: PublicKey;
    encodedVaaAddress: PublicKey;
  }> {
    const accumulatorUpdateData = parseAccumulatorUpdateData(
      Buffer.from(vaa, "base64")
    );

    const encodedVaaKeypair = new Keypair();
    const encodedVaaSize = accumulatorUpdateData.vaa.length + VAA_START;

    const guardianSetIndex = getGuardianSetIndex(accumulatorUpdateData.vaa);

    const firstTransactionInstructions: TransactionInstruction[] = [
      await this.wormhole.account.encodedVaa.createInstruction(
        encodedVaaKeypair,
        encodedVaaSize
      ),
      await this.wormhole.methods
        .initEncodedVaa()
        .accounts({
          encodedVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      await this.wormhole.methods
        .writeEncodedVaa({
          index: 0,
          data: accumulatorUpdateData.vaa.subarray(0, VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .signers([encodedVaaKeypair])
        .instruction(),
    ];

    const priceUpdateKeypair = new Keypair();
    const secondTransactionInstructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
      await this.wormhole.methods
        .writeEncodedVaa({
          index: VAA_SPLIT_INDEX,
          data: accumulatorUpdateData.vaa.subarray(VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      await this.wormhole.methods
        .verifyEncodedVaaV1()
        .accounts({
          guardianSet: getGuardianSetPda(guardianSetIndex),
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      await this.receiver.methods
        .postUpdate({
          merklePriceUpdate: accumulatorUpdateData.updates[0],
          treasuryId: DEFAULT_TREASURY_ID,
        })
        .accounts({
          encodedVaa: encodedVaaKeypair.publicKey,
          priceUpdateAccount: priceUpdateKeypair.publicKey,
          treasury: getTreasuryPda(DEFAULT_TREASURY_ID),
          config: getConfigPda(),
        })
        .signers([priceUpdateKeypair])
        .instruction(),
    ];

    return {
      transactions: [
        {
          instructions: firstTransactionInstructions,
          signers: [encodedVaaKeypair],
        },
        {
          instructions: secondTransactionInstructions,
          signers: [priceUpdateKeypair],
        },
      ],
      priceUpdateAddress: priceUpdateKeypair.publicKey,
      encodedVaaAddress: encodedVaaKeypair.publicKey,
    };
  }
}
