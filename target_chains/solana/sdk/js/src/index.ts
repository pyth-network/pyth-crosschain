import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, TransactionInstruction } from "@solana/web3.js";
import { PythSolanaReceiver } from "./idl/pyth_solana_receiver";
import Idl from "./idl/pyth_solana_receiver.json";
import {
  WormholeCoreBridgeSolana,
  IDL as WormholeCoreBridgeSolanaIdl,
} from "./idl/wormhole_core_bridge_solana";
import {
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
} from "./address";
import { PublicKey, Keypair } from "@solana/web3.js";
import { parseAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { VAA_SPLIT_INDEX, VAA_START } from "./constants";

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
    this.provider = new AnchorProvider(this.connection, this.wallet, {});
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

  async postPriceUpdate(vaa: string): Promise<PublicKey> {
    const accumulatorUpdateData = parseAccumulatorUpdateData(
      Buffer.from(vaa, "base64")
    );

    const encodedVaaKeypair = new Keypair();
    const encodedVaaSize = accumulatorUpdateData.vaa.length + VAA_START;

    const firstTransactionInstructions: TransactionInstruction[] = [
      await this.wormhole.account.encodedVaa.createInstruction(
        encodedVaaKeypair,
        encodedVaaSize
      ),
    ];

    await this.wormhole.methods
      .writeEncodedVaa({
        index: 0,
        data: accumulatorUpdateData.vaa.subarray(0, VAA_SPLIT_INDEX),
      })
      .accounts({
        draftVaa: encodedVaaKeypair.publicKey,
      })
      .preInstructions(firstTransactionInstructions)
      .rpc();

    return encodedVaaKeypair.publicKey;
  }
}
