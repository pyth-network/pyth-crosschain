import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
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
import { PublicKey, SystemProgram } from "@solana/web3.js";

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
    const vaa2 = Buffer.from(vaa, "base64");
    console.log(vaa2.toString("hex"));
    return SystemProgram.programId;
  }
}
