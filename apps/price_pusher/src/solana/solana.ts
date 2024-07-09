import { pythSolanaReceiverIdl, PythSolanaReceiverProgram, PythTransactionBuilder } from "@pythnetwork/pyth-solana-receiver";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  sendTransactions,
  sendTransactionsJito,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { AddressLookupTableAccount, Connection, VersionedTransaction } from "@solana/web3.js";
import { DRIFT_ORACLE_RECEIVER_ID, DriftClient, FastSingleTxSender, getPythPullOraclePublicKey, Wallet } from "@drift-labs/sdk";
import { getFeedIdUint8Array } from "@drift-labs/sdk/lib/util/pythPullOracleUtils"
import { PriceUpdateAccount } from "@pythnetwork/pyth-solana-receiver/lib/PythSolanaReceiver";
import { Program } from "@coral-xyz/anchor";

export class SolanaPriceListener extends ChainPriceListener {
  // @ts-ignore
  pythSolanaReceiver: Program<PythSolanaReceiverProgram>;

  constructor(
    private driftClient: DriftClient,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("solana", config.pollingFrequency, priceItems);
    // @ts-ignore
    this.pythSolanaReceiver = this.driftClient.getReceiverProgram();
  }

  getPriceFeedAccountAddress(priceId: string) {
    return getPythPullOraclePublicKey(
      this.driftClient.program.programId, 
      getFeedIdUint8Array(priceId)
    )
  }

  async fetchPriceFeedAccount(priceId: string): Promise<PriceUpdateAccount | null> {
    // @ts-ignore
    return await this.pythSolanaReceiver.account.priceUpdateV2.fetchNullable(
      this.getPriceFeedAccountAddress(priceId),
      'confirmed'
    )
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceFeedAccount =
        await this.fetchPriceFeedAccount(
          priceId
        );
      console.log(
        `Polled a Solana on chain price for feed ${this.priceIdToAlias.get(
          priceId
        )} (${priceId}).`
      );
      if (priceFeedAccount) {
        return {
          conf: priceFeedAccount.priceMessage.conf.toString(),
          price: priceFeedAccount.priceMessage.price.toString(),
          publishTime: priceFeedAccount.priceMessage.publishTime.toNumber(),
        };
      } else {
        return undefined;
      }
    } catch (e) {
      console.error(`Polling on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }
  }
}

export class SolanaPricePusher implements IPricePusher {
  txSender: FastSingleTxSender;

  constructor(
    private driftClient: DriftClient,
    private priceServiceConnection: PriceServiceConnection,
    private computeUnitPriceMicroLamports: number,
    private addressLookupTable: AddressLookupTableAccount
  ) {

    this.txSender = new FastSingleTxSender({
      connection: this.driftClient.connection,
      blockhashCommitment: 'confirmed',
      blockhashRefreshInterval: 1000,
      wallet: this.driftClient.wallet,
      opts: {
        skipPreflight: true,
        maxRetries: 0,
      }
    });
  }

  async pushPriceUpdatesAtomic(
    priceIds: string[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    for (const priceId of priceIds) {
      let priceFeedUpdateData: string[];
      try {
        priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
          [priceId]
        );
      } catch (e: any) {
        console.error(new Date(), "getPriceFeedsUpdateData failed:", e);
        return
      }
      
      const ixs = await this.driftClient.getPostPythPullOracleUpdateAtomicIxs(
        priceFeedUpdateData[0],
        priceId,
        3
      )
      const tx = await this.txSender.getVersionedTransaction(ixs, [this.addressLookupTable],
        undefined, undefined, this.txSender.recentBlockhash ?? await this.txSender.connection.getLatestBlockhash('confirmed')
      );
      this.txSender.sendVersionedTransaction(tx).then((txSig) => {
        console.log(new Date(), `updatePriceFeed successful: ${txSig.txSig}`);
      }).catch((e) => {
        console.error(new Date(), "updatePriceFeed failed", e);
      });
    }
  }
}

const UPDATES_PER_JITO_BUNDLE = 5;

export class SolanaPricePusherJito implements IPricePusher {
  constructor(
    private driftClient: DriftClient,
    private priceServiceConnection: PriceServiceConnection,
    private jitoTipLamports: number,
    private jitoBundleSize: number,
    private addressLookupTable: AddressLookupTableAccount
  ) {}

  async pushPriceUpdatesAtomic(
    priceIds: string[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    let priceFeedUpdateData: string[];
    try {
      priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
        priceIds
      );
    } catch (e: any) {
      console.error(new Date(), "getPriceFeedsUpdateData failed:", e);
      return;
    }

    for (let i = 0; i < priceIds.length; i += UPDATES_PER_JITO_BUNDLE) {
      const transactionBuilder = new TransactionBuilder(
        this.driftClient.wallet.publicKey,
        this.driftClient.connection,
        this.addressLookupTable
      );
      const priceId = priceIds[i];
      const ixs = await this.driftClient.getPostPythPullOracleUpdateAtomicIxs(
        priceFeedUpdateData[0],
        priceId,
      )
      const ixsWithEmphemeralSigners = ixs.map((ix) => {
        return {
          instruction: ix,
          signers: [],
        }
      })
      transactionBuilder.addInstructions(ixsWithEmphemeralSigners);
      const transactions = await transactionBuilder.buildVersionedTransactions({
        jitoTipLamports: this.jitoTipLamports,
        tightComputeBudget: true,
        jitoBundleSize: this.jitoBundleSize,
      });
  
      try {
        await sendTransactions(
          transactions,
          this.driftClient.connection,
          // @ts-ignore
          this.driftClient.wallet
        );
        console.log(new Date(), "updatePriceFeed successful");
      } catch (e: any) {
        console.error(new Date(), "updatePriceFeed failed", e);
        return;
      }
    }

   
  }
}
