/** biome-ignore-all lint/suspicious/noExplicitAny: anchor account access is untyped */
import type { Idl } from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { pythSolanaReceiverIdl } from "@pythnetwork/pyth-solana-receiver";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import { Keypair, PublicKey } from "@solana/web3.js";

import type { KeyValueConfig, PriceFeed, PrivateKey, TxResult } from "../base";
import { PriceFeedContract } from "../base";
import type { Chain } from "../chains";
import { SolanaChain } from "../chains";
import { WormholeContract } from "./wormhole";

export class SolanaWormholeContract extends WormholeContract {
  static type = "SolanaWormholeContract";

  constructor(
    public chain: SolanaChain,
    public address: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}__${this.address}`;
  }

  getChain(): SolanaChain {
    return this.chain;
  }

  getType(): string {
    return SolanaWormholeContract.type;
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): SolanaWormholeContract {
    if (parsed.type !== SolanaWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof SolanaChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new SolanaWormholeContract(chain, parsed.address);
  }

  toJson(): KeyValueConfig {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: SolanaWormholeContract.type,
    };
  }

  upgradeGuardianSets(
    _senderPrivateKey: PrivateKey,
    _vaa: Buffer,
  ): Promise<TxResult> {
    throw new Error(
      "Solana wormhole contract doesn't implement upgradeGuardianSets method",
    );
  }

  getCurrentGuardianSetIndex(): Promise<number> {
    throw new Error(
      "Solana wormhole contract doesn't implement getCurrentGuardianSetIndex method",
    );
  }

  getChainId(): Promise<number> {
    throw new Error(
      "Solana wormhole contract doesn't implement getChainId method",
    );
  }

  getGuardianSet(): Promise<string[]> {
    throw new Error(
      "Solana wormhole contract doesn't implement getGuardianSet method",
    );
  }
}

const PUSH_ORACLE_PROGRAM_ID = new PublicKey(
  "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT",
);

export class SolanaPriceFeedContract extends PriceFeedContract {
  public static type = "SolanaPriceFeedContract";

  constructor(
    public chain: SolanaChain,
    public address: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}__${this.address}`;
  }

  getType(): string {
    return SolanaPriceFeedContract.type;
  }

  getChain(): SolanaChain {
    return this.chain;
  }

  toJson(): KeyValueConfig {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: SolanaPriceFeedContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): SolanaPriceFeedContract {
    if (parsed.type !== SolanaPriceFeedContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof SolanaChain)) {
      throw new TypeError(`Wrong chain type ${chain}`);
    }
    return new SolanaPriceFeedContract(chain, parsed.address);
  }

  private getReceiverProgram(): Program {
    const connection = this.chain.getConnection();
    const dummyWallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(connection, dummyWallet, {
      commitment: "confirmed",
    });
    const receiverProgramId = new PublicKey(this.address);
    return new Program(
      pythSolanaReceiverIdl as Idl,
      receiverProgramId,
      provider,
    );
  }

  private getConfigPda(): PublicKey {
    const receiverProgramId = new PublicKey(this.address);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      receiverProgramId,
    )[0];
  }

  getValidTimePeriod(): Promise<number> {
    throw new Error(
      "Solana receiver doesn't store a valid time period on-chain",
    );
  }

  async getDataSources(): Promise<DataSource[]> {
    const program = this.getReceiverProgram();
    const configPda = this.getConfigPda();
    const config = await (program.account as any).config.fetch(configPda);
    const validDataSources = config.validDataSources as {
      chain: number;
      emitter: PublicKey;
    }[];
    return validDataSources.map((ds) => ({
      emitterAddress: ds.emitter.toBuffer().toString("hex"),
      emitterChain: ds.chain,
    }));
  }

  async getBaseUpdateFee(): Promise<{ amount: string }> {
    const program = this.getReceiverProgram();
    const configPda = this.getConfigPda();
    const config = await (program.account as any).config.fetch(configPda);
    return { amount: (config.singleUpdateFeeInLamports as bigint).toString() };
  }

  getGovernanceDataSource(): Promise<DataSource> {
    throw new Error(
      "Solana receiver uses authority-based governance, not VAA-based data source governance",
    );
  }

  getLastExecutedGovernanceSequence(): Promise<number> {
    return Promise.resolve(0);
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const connection = this.chain.getConnection();
    const feedIdBuffer = Buffer.from(
      feedId.startsWith("0x") ? feedId.slice(2) : feedId,
      "hex",
    );
    const shardId = 0;
    const shardIdBuffer = Buffer.alloc(2);
    shardIdBuffer.writeUInt16LE(shardId);
    const [priceFeedAccount] = PublicKey.findProgramAddressSync(
      [shardIdBuffer, feedIdBuffer],
      PUSH_ORACLE_PROGRAM_ID,
    );

    const accountInfo = await connection.getAccountInfo(priceFeedAccount);
    if (!accountInfo) return undefined;

    // Parse price update v2 account data using anchor discriminator offset
    // The account layout after the 8-byte discriminator is:
    // writeAuthority (32) + verificationLevel (4) + PriceFeedMessage
    const data = accountInfo.data;
    const offset = 8 + 32 + 4; // discriminator + writeAuthority + verificationLevel
    // PriceFeedMessage: feedId(32) + price(i64) + conf(u64) + exponent(i32) + publishTime(i64) + prevPublishTime(i64) + emaPrice(i64) + emaConf(u64)
    const price = data.readBigInt64LE(offset + 32);
    const conf = data.readBigUInt64LE(offset + 40);
    const exponent = data.readInt32LE(offset + 48);
    const publishTime = data.readBigInt64LE(offset + 52);
    const emaPrice = data.readBigInt64LE(offset + 68);
    const emaConf = data.readBigUInt64LE(offset + 76);

    return {
      emaPrice: {
        conf: emaConf.toString(),
        expo: exponent.toString(),
        price: emaPrice.toString(),
        publishTime: publishTime.toString(),
      },
      price: {
        conf: conf.toString(),
        expo: exponent.toString(),
        price: price.toString(),
        publishTime: publishTime.toString(),
      },
    };
  }

  executeUpdatePriceFeed(
    _senderPrivateKey: PrivateKey,
    _vaas: Buffer[],
  ): Promise<TxResult> {
    throw new Error(
      "Use @pythnetwork/pyth-solana-receiver SDK directly for updating price feeds on Solana",
    );
  }

  executeGovernanceInstruction(
    _senderPrivateKey: PrivateKey,
    _vaa: Buffer,
  ): Promise<TxResult> {
    throw new Error(
      "Solana receiver uses authority-based governance; governance instructions are not VAA-based",
    );
  }
}
