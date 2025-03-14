import { AnchorProvider, IdlAccounts, Program } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  Connection,
  Signer,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  PythSolanaReceiver as PythSolanaReceiverProgram,
  IDL as Idl,
} from "./idl/pyth_solana_receiver";
import {
  WormholeCoreBridgeSolana,
  IDL as WormholeCoreBridgeSolanaIdl,
} from "./idl/wormhole_core_bridge_solana";
import {
  DEFAULT_PUSH_ORACLE_PROGRAM_ID,
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  getConfigPda,
  getGuardianSetPda,
  getRandomTreasuryId,
  getTreasuryPda,
} from "./address";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
  parseTwapMessage,
} from "@pythnetwork/price-service-sdk";
import {
  POST_TWAP_UPDATE_COMPUTE_BUDGET,
  POST_UPDATE_ATOMIC_COMPUTE_BUDGET,
  POST_UPDATE_COMPUTE_BUDGET,
  UPDATE_PRICE_FEED_COMPUTE_BUDGET,
} from "./compute_budget";
import { Wallet } from "@coral-xyz/anchor";
import {
  buildCloseEncodedVaaInstruction,
  buildPostEncodedVaaInstructions,
  buildPostEncodedVaasForTwapInstructions,
  findEncodedVaaAccountsByWriteAuthority,
  getGuardianSetIndex,
  trimSignatures,
} from "./vaa";
import {
  TransactionBuilder,
  InstructionWithEphemeralSigners,
  PriorityFeeConfig,
} from "@pythnetwork/solana-utils";
import {
  PythPushOracle,
  IDL as PythPushOracleIdl,
} from "./idl/pyth_push_oracle";

export type PriceUpdateAccount =
  IdlAccounts<PythSolanaReceiverProgram>["priceUpdateV2"];
export type TwapUpdateAccount =
  IdlAccounts<PythSolanaReceiverProgram>["twapUpdate"];
/**
 * Configuration for the PythTransactionBuilder
 * @property closeUpdateAccounts (default: true) if true, the builder will add instructions to close the price update accounts and the encoded vaa accounts to recover the rent
 */
export type PythTransactionBuilderConfig = {
  closeUpdateAccounts?: boolean;
};

/**
 * A stable treasury ID. This ID's corresponding treasury address
 * can be cached in an account lookup table in order to reduce the overall txn size.
 */
export const DEFAULT_TREASURY_ID = 0;

/**
 * A builder class to build transactions that:
 * - Post price updates (fully or partially verified) or update price feed accounts
 * - Consume price updates in a consumer program
 * - (Optionally) Close price update and encoded vaa accounts to recover the rent (`closeUpdateAccounts` in `PythTransactionBuilderConfig`)
 *
 * This class provides methods for working with both price update accounts and price feed accounts.
 * Price update accounts are ephemeral accounts containing a single price update, whereas price feed accounts are long-lived
 * accounts that always hold price data for a specific feed id. Price feed accounts can be updated to advance the current price.
 * Applications should choose which type of account to work with based on their needs. In general, applications that
 * want the price at a specific time (e.g., to settle a trade) should use price update accounts, while applications that want
 * any recent price should use price feed accounts.
 *
 * @example
 * ```typescript
 *
 * // Get the price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
 *  const priceUpdateData = await priceServiceConnection.getLatestVaas([
 *    SOL_PRICE_FEED_ID,
 *    ETH_PRICE_FEED_ID,
 *  ]);
 *
 * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
 * await transactionBuilder.addPostPriceUpdates(priceUpdateData);
 * console.log("The SOL/USD price update will get posted to:", transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58())
 * await transactionBuilder.addPriceConsumerInstructions(...)
 *
 * await pythSolanaReceiver.provider.sendAll(await transactionBuilder.buildVersionedTransactions({computeUnitPriceMicroLamports:100000, tightComputeBudget: true}))
 * ```
 */
export class PythTransactionBuilder extends TransactionBuilder {
  readonly pythSolanaReceiver: PythSolanaReceiver;
  readonly closeInstructions: InstructionWithEphemeralSigners[];
  readonly priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
  readonly priceFeedIdToTwapUpdateAccount: Record<string, PublicKey>;
  readonly closeUpdateAccounts: boolean;

  constructor(
    pythSolanaReceiver: PythSolanaReceiver,
    config: PythTransactionBuilderConfig,
    addressLookupTable?: AddressLookupTableAccount,
  ) {
    super(
      pythSolanaReceiver.wallet.publicKey,
      pythSolanaReceiver.connection,
      addressLookupTable,
    );
    this.pythSolanaReceiver = pythSolanaReceiver;
    this.closeInstructions = [];
    this.priceFeedIdToPriceUpdateAccount = {};
    this.priceFeedIdToTwapUpdateAccount = {};
    this.closeUpdateAccounts = config.closeUpdateAccounts ?? true;
  }

  /**
   * Add instructions to post price updates to the builder.
   * Use this function to post fully verified price updates from the present or from the past for your program to consume.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   *
   * @example
   * ```typescript
   * // Get the price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
   * const priceUpdateData = await priceServiceConnection.getLatestVaas([
   *    SOL_PRICE_FEED_ID,
   *    ETH_PRICE_FEED_ID,
   * ]);
   *
   * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
   * await transactionBuilder.addPostPriceUpdates(priceUpdateData);
   * console.log("The SOL/USD price update will get posted to:", transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58())
   * await transactionBuilder.addPriceConsumerInstructions(...)
   * ```
   */
  async addPostPriceUpdates(priceUpdateDataArray: string[]) {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    } =
      await this.pythSolanaReceiver.buildPostPriceUpdateInstructions(
        priceUpdateDataArray,
      );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToPriceUpdateAccount,
      priceFeedIdToPriceUpdateAccount,
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions to post partially verified price updates to the builder.
   * Use this function to post partially verified price updates from the present or from the past for your program to consume.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   *
   * Partially verified price updates are price updates where not all the guardian signatures have been verified. By default this methods checks `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` signatures when posting the VAA.
   * If you are a on-chain program developer, make sure you understand the risks of consuming partially verified price updates here: {@link https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_sdk/src/price_update.rs}.
   *
   * @example
   * ```typescript
   * // Get the price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
   * const priceUpdateData = await priceServiceConnection.getLatestVaas([
   *    SOL_PRICE_FEED_ID,
   *    ETH_PRICE_FEED_ID,
   * ]);
   *
   * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
   * await transactionBuilder.addPostPartiallyVerifiedPriceUpdates(priceUpdateData);
   * console.log("The SOL/USD price update will get posted to:", transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58())
   * await transactionBuilder.addPriceConsumerInstructions(...)
   * ...
   * ```
   */
  async addPostPartiallyVerifiedPriceUpdates(priceUpdateDataArray: string[]) {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    } =
      await this.pythSolanaReceiver.buildPostPriceUpdateAtomicInstructions(
        priceUpdateDataArray,
      );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToPriceUpdateAccount,
      priceFeedIdToPriceUpdateAccount,
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions to post TWAP updates to the builder.
   * Use this function to post fully verified TWAP updates from the present or from the past for your program to consume.
   *
   * @param twapUpdateDataArray the output of the `@pythnetwork/hermes-client`'s `getLatestTwaps`. This is an array of verifiable price updates.
   *
   * @example
   * ```typescript
   * // Get the price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
   * const twapUpdateData = await hermesClient.getLatestTwaps([
   *    SOL_PRICE_FEED_ID,
   *    ETH_PRICE_FEED_ID,
   * ]);
   *
   * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
   * await transactionBuilder.addPostTwapUpdates(priceUpdateData);
   * console.log("The SOL/USD price update will get posted to:", transactionBuilder.getTwapUpdateAccount(SOL_PRICE_FEED_ID).toBase58())
   * await transactionBuilder.addTwapConsumerInstructions(...)
   * ```
   */
  async addPostTwapUpdates(twapUpdateDataArray: string[]) {
    const {
      postInstructions,
      priceFeedIdToTwapUpdateAccount,
      closeInstructions,
    } =
      await this.pythSolanaReceiver.buildPostTwapUpdateInstructions(
        twapUpdateDataArray,
      );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToTwapUpdateAccount,
      priceFeedIdToTwapUpdateAccount,
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions to update price feed accounts to the builder.
   * Price feed accounts are fixed accounts per price feed id that can only be updated with a more recent price.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @param shardId the shard ID of the set of price feed accounts. This shard ID allows for multiple price feed accounts for the same price feed id to exist.
   *
   * @example
   * ```typescript
   * // Get the price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
   * const priceUpdateData = await priceServiceConnection.getLatestVaas([
   *    SOL_PRICE_FEED_ID,
   *    ETH_PRICE_FEED_ID,
   * ]);
   *
   * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
   * await transactionBuilder.addUpdatePriceFeed(priceUpdateData);
   * await transactionBuilder.addPriceConsumerInstructions(...)
   * ...
   * ```
   */
  async addUpdatePriceFeed(priceUpdateDataArray: string[], shardId: number) {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    } = await this.pythSolanaReceiver.buildUpdatePriceFeedInstructions(
      priceUpdateDataArray,
      shardId,
    );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToPriceUpdateAccount,
      priceFeedIdToPriceUpdateAccount,
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions that consume price updates to the builder.
   *
   * @param getInstructions a function that given a mapping of price feed IDs to price update accounts, generates a series of instructions. Price updates get posted to ephemeral accounts and this function allows the user to indicate which accounts in their instruction need to be "replaced" with each price update account.
   * If multiple price updates for the same price feed ID are posted with the same builder, the account corresponding to the last update to get posted will be used.
   *
   * @example
   * ```typescript
   * ...
   * await transactionBuilder.addPostPriceUpdates(priceUpdateData);
   * await transactionBuilder.addPriceConsumerInstructions(
   *   async (
   *     getPriceUpdateAccount: ( priceFeedId: string) => PublicKey
   *   ): Promise<InstructionWithEphemeralSigners[]> => {
   *     return [
   *       {
   *         instruction: await myFirstPythApp.methods
   *           .consume()
   *           .accounts({
   *              solPriceUpdate: getPriceUpdateAccount(SOL_PRICE_FEED_ID),
   *              ethPriceUpdate: getPriceUpdateAccount(ETH_PRICE_FEED_ID),
   *           })
   *           .instruction(),
   *         signers: [],
   *       },
   *     ];
   *   }
   * );
   * ```
   */
  async addPriceConsumerInstructions(
    getInstructions: (
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey,
    ) => Promise<InstructionWithEphemeralSigners[]>,
  ) {
    this.addInstructions(
      await getInstructions(this.getPriceUpdateAccount.bind(this)),
    );
  }

  /**
   * Add instructions that consume TWAP updates to the builder.
   *
   * @param getInstructions a function that given a mapping of price feed IDs to TWAP update accounts, generates a series of instructions. TWAP updates get posted to ephemeral accounts and this function allows the user to indicate which accounts in their instruction need to be "replaced" with each price update account.
   * If multiple TWAP updates for the same price feed ID are posted with the same builder, the account corresponding to the last update to get posted will be used.
   *
   * @example
   * ```typescript
   * ...
   * await transactionBuilder.addPostTwapUpdates(twapUpdateData);
   * await transactionBuilder.addTwapConsumerInstructions(
   *   async (
   *     getTwapUpdateAccount: ( priceFeedId: string) => PublicKey
   *   ): Promise<InstructionWithEphemeralSigners[]> => {
   *     return [
   *       {
   *         instruction: await myFirstPythApp.methods
   *           .consume()
   *           .accounts({
   *              solTwapUpdate: getTwapUpdateAccount(SOL_PRICE_FEED_ID),
   *              ethTwapUpdate: getTwapUpdateAccount(ETH_PRICE_FEED_ID),
   *           })
   *           .instruction(),
   *         signers: [],
   *       },
   *     ];
   *   }
   * );
   * ```
   */
  async addTwapConsumerInstructions(
    getInstructions: (
      getTwapUpdateAccount: (priceFeedId: string) => PublicKey,
    ) => Promise<InstructionWithEphemeralSigners[]>,
  ) {
    this.addInstructions(
      await getInstructions(this.getTwapUpdateAccount.bind(this)),
    );
  }

  /** Add instructions to close encoded VAA accounts from previous actions.
   * If you have previously used the PythTransactionBuilder with closeUpdateAccounts set to false or if you posted encoded VAAs but the transaction to close them did not land on-chain, your wallet might own many encoded VAA accounts.
   * The rent cost for these accounts is 0.008 SOL per encoded VAA account. You can recover this rent calling this function when building a set of transactions.
   */
  async addClosePreviousEncodedVaasInstructions(maxInstructions = 40) {
    this.addInstructions(
      await this.pythSolanaReceiver.buildClosePreviousEncodedVaasInstructions(
        maxInstructions,
      ),
    );
  }

  /**
   * Returns all the added instructions batched into versioned transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  async buildVersionedTransactions(
    args: PriorityFeeConfig,
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    if (this.closeUpdateAccounts) {
      this.addInstructions(this.closeInstructions);
    }
    return super.buildVersionedTransactions(args);
  }

  /**
   * Returns all the added instructions batched into transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  buildLegacyTransactions(
    args: PriorityFeeConfig,
  ): { tx: Transaction; signers: Signer[] }[] {
    if (this.closeUpdateAccounts) {
      this.addInstructions(this.closeInstructions);
    }
    return super.buildLegacyTransactions(args);
  }

  /**
   * This method is used to retrieve the address of the price update account where the price update for a given price feed ID will be posted.
   * If multiple price updates for the same price feed ID will be posted with the same builder, the address of the account corresponding to the last update to get posted will be returned.
   * */
  getPriceUpdateAccount(priceFeedId: string): PublicKey {
    const priceUpdateAccount =
      this.priceFeedIdToPriceUpdateAccount[priceFeedId];
    if (!priceUpdateAccount) {
      throw new Error(
        `No price update account found for the price feed ID ${priceFeedId}. Make sure to call addPostPriceUpdates or addPostPartiallyVerifiedPriceUpdates before calling this function.`,
      );
    }
    return priceUpdateAccount;
  }

  /**
   * This method is used to retrieve the address of the TWAP update account where the TWAP update for a given price feed ID will be posted.
   * If multiple updates for the same price feed ID will be posted with the same builder, the address of the account corresponding to the last update to get posted will be returned.
   * */
  getTwapUpdateAccount(priceFeedId: string): PublicKey {
    const twapUpdateAccount = this.priceFeedIdToTwapUpdateAccount[priceFeedId];
    if (!twapUpdateAccount) {
      throw new Error(
        `No TWAP update account found for the price feed ID ${priceFeedId}. Make sure to call addPostTwapUpdates before calling this function.`,
      );
    }
    return twapUpdateAccount;
  }
}

/**
 * A class to interact with the Pyth Solana Receiver program.
 *
 * This class provides helpful methods to build instructions to interact with the Pyth Solana Receiver program:
 * - Post price updates (fully or partially verified)
 * - Close price update and encoded vaa accounts to recover rent
 */
export class PythSolanaReceiver {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly provider: AnchorProvider;
  readonly receiver: Program<PythSolanaReceiverProgram>;
  readonly wormhole: Program<WormholeCoreBridgeSolana>;
  readonly pushOracle: Program<PythPushOracle>;
  readonly treasuryId?: number;
  constructor({
    connection,
    wallet,
    wormholeProgramId = DEFAULT_WORMHOLE_PROGRAM_ID,
    receiverProgramId = DEFAULT_RECEIVER_PROGRAM_ID,
    pushOracleProgramId = DEFAULT_PUSH_ORACLE_PROGRAM_ID,
    treasuryId = undefined,
  }: {
    connection: Connection;
    wallet: Wallet;
    wormholeProgramId?: PublicKey;
    receiverProgramId?: PublicKey;
    pushOracleProgramId?: PublicKey;
    // Optionally provide a treasuryId to always use a specific treasury account.
    // This can be useful when using an ALT to reduce tx size.
    // If not provided, treasury accounts will be randomly selected.
    treasuryId?: number;
  }) {
    if (treasuryId !== undefined && (treasuryId < 0 || treasuryId > 255)) {
      throw new Error("treasuryId must be between 0 and 255");
    }

    this.connection = connection;
    this.wallet = wallet;
    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: connection.commitment,
    });
    this.receiver = new Program<PythSolanaReceiverProgram>(
      Idl as PythSolanaReceiverProgram,
      receiverProgramId,
      this.provider,
    );
    this.wormhole = new Program<WormholeCoreBridgeSolana>(
      WormholeCoreBridgeSolanaIdl as WormholeCoreBridgeSolana,
      wormholeProgramId,
      this.provider,
    );
    this.pushOracle = new Program<PythPushOracle>(
      PythPushOracleIdl as PythPushOracle,
      pushOracleProgramId,
      this.provider,
    );
    this.treasuryId = treasuryId;
  }

  /**
   * Get a new transaction builder to build transactions that interact with the Pyth Solana Receiver program and consume price updates
   */
  newTransactionBuilder(
    config: PythTransactionBuilderConfig,
    addressLookupAccount?: AddressLookupTableAccount,
  ): PythTransactionBuilder {
    return new PythTransactionBuilder(this, config, addressLookupAccount);
  }

  /**
   * Build a series of helper instructions that post price updates to the Pyth Solana Receiver program and another series to close the price update accounts.
   *
   * This function uses partially verified price updates. Partially verified price updates are price updates where not all the guardian signatures have been verified. By default this methods checks `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` signatures when posting the VAA.
   * If you are a on-chain program developer, make sure you understand the risks of consuming partially verified price updates here: {@link https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_sdk/src/price_update.rs}.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @returns `postInstructions`: the instructions to post the price updates, these should be called before consuming the price updates
   * @returns `priceFeedIdToPriceUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the price update.
   * @returns `closeInstructions`: the instructions to close the price update accounts, these should be called after consuming the price updates
   */
  async buildPostPriceUpdateAtomicInstructions(
    priceUpdateDataArray: string[],
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    const treasuryId = this.treasuryId ?? getRandomTreasuryId();

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64"),
      );
      const guardianSetIndex = getGuardianSetIndex(accumulatorUpdateData.vaa);
      const trimmedVaa = trimSignatures(accumulatorUpdateData.vaa);

      for (const update of accumulatorUpdateData.updates) {
        const priceUpdateKeypair = new Keypair();
        postInstructions.push({
          instruction: await this.receiver.methods
            .postUpdateAtomic({
              vaa: trimmedVaa,
              merklePriceUpdate: update,
              treasuryId,
            })
            .accounts({
              priceUpdateAccount: priceUpdateKeypair.publicKey,
              treasury: getTreasuryPda(treasuryId, this.receiver.programId),
              config: getConfigPda(this.receiver.programId),
              guardianSet: getGuardianSetPda(
                guardianSetIndex,
                this.wormhole.programId,
              ),
            })
            .instruction(),
          signers: [priceUpdateKeypair],
          computeUnits: POST_UPDATE_ATOMIC_COMPUTE_BUDGET,
        });
        priceFeedIdToPriceUpdateAccount[
          "0x" + parsePriceFeedMessage(update.message).feedId.toString("hex")
        ] = priceUpdateKeypair.publicKey;

        closeInstructions.push(
          await this.buildClosePriceUpdateInstruction(
            priceUpdateKeypair.publicKey,
          ),
        );
      }
    }
    return {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    };
  }

  /**
   * Build a series of helper instructions that post price updates to the Pyth Solana Receiver program and another series to close the encoded vaa accounts and the price update accounts.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @returns `postInstructions`: the instructions to post the price updates, these should be called before consuming the price updates
   * @returns `priceFeedIdToPriceUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the price update.
   * @returns `closeInstructions`: the instructions to close the price update accounts, these should be called after consuming the price updates
   */
  async buildPostPriceUpdateInstructions(
    priceUpdateDataArray: string[],
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    const treasuryId = this.treasuryId ?? getRandomTreasuryId();

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64"),
      );

      const {
        postInstructions: postEncodedVaaInstructions,
        encodedVaaAddress: encodedVaa,
        closeInstructions: postEncodedVaacloseInstructions,
      } = await this.buildPostEncodedVaaInstructions(accumulatorUpdateData.vaa);
      postInstructions.push(...postEncodedVaaInstructions);
      closeInstructions.push(...postEncodedVaacloseInstructions);

      for (const update of accumulatorUpdateData.updates) {
        const priceUpdateKeypair = new Keypair();
        postInstructions.push({
          instruction: await this.receiver.methods
            .postUpdate({
              merklePriceUpdate: update,
              treasuryId,
            })
            .accounts({
              encodedVaa,
              priceUpdateAccount: priceUpdateKeypair.publicKey,
              treasury: getTreasuryPda(treasuryId, this.receiver.programId),
              config: getConfigPda(this.receiver.programId),
            })
            .instruction(),
          signers: [priceUpdateKeypair],
          computeUnits: POST_UPDATE_COMPUTE_BUDGET,
        });

        priceFeedIdToPriceUpdateAccount[
          "0x" + parsePriceFeedMessage(update.message).feedId.toString("hex")
        ] = priceUpdateKeypair.publicKey;
        closeInstructions.push(
          await this.buildClosePriceUpdateInstruction(
            priceUpdateKeypair.publicKey,
          ),
        );
      }
    }

    return {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    };
  }

  /**
   * Build a series of helper instructions that post TWAP updates to the Pyth Solana Receiver program and another series to close the encoded vaa accounts and the TWAP update accounts.
   *
   * @param twapUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestTwaps`. This is an array of verifiable price updates.
   * @returns `postInstructions`: the instructions to post the TWAP updates, these should be called before consuming the price updates
   * @returns `priceFeedIdToTwapUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the TWAP update.
   * @returns `closeInstructions`: the instructions to close the TWAP update accounts, these should be called after consuming the TWAP updates
   */
  async buildPostTwapUpdateInstructions(
    twapUpdateDataArray: string[],
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToTwapUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToTwapUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    const treasuryId = this.treasuryId ?? getRandomTreasuryId();

    if (twapUpdateDataArray.length !== 2) {
      throw new Error(
        "twapUpdateDataArray must contain exactly two updates (start and end)",
      );
    }

    const [startUpdateData, endUpdateData] = twapUpdateDataArray.map((data) =>
      parseAccumulatorUpdateData(Buffer.from(data, "base64")),
    );

    // Validate that the start and end updates contain the same number of price feeds
    if (startUpdateData.updates.length !== endUpdateData.updates.length) {
      throw new Error(
        "Start and end updates must contain the same number of price feeds",
      );
    }

    // Post encoded VAAs
    const {
      postInstructions: buildVaasInstructions,
      closeInstructions: closeVaasInstructions,
      startEncodedVaaAddress,
      endEncodedVaaAddress,
    } = await buildPostEncodedVaasForTwapInstructions(
      this.wormhole,
      startUpdateData,
      endUpdateData,
    );
    postInstructions.push(...buildVaasInstructions);
    closeInstructions.push(...closeVaasInstructions);

    // Post a TWAP update to the receiver contract for each price feed
    for (let i = 0; i < startUpdateData.updates.length; i++) {
      const startUpdate = startUpdateData.updates[i];
      const endUpdate = endUpdateData.updates[i];

      const twapUpdateKeypair = new Keypair();
      postInstructions.push({
        instruction: await this.receiver.methods
          .postTwapUpdate({
            startMerklePriceUpdate: startUpdate,
            endMerklePriceUpdate: endUpdate,
            treasuryId,
          })
          .accounts({
            startEncodedVaa: startEncodedVaaAddress,
            endEncodedVaa: endEncodedVaaAddress,
            twapUpdateAccount: twapUpdateKeypair.publicKey,
            treasury: getTreasuryPda(treasuryId, this.receiver.programId),
            config: getConfigPda(this.receiver.programId),
          })
          .instruction(),
        signers: [twapUpdateKeypair],
        computeUnits: POST_TWAP_UPDATE_COMPUTE_BUDGET,
      });

      priceFeedIdToTwapUpdateAccount[
        "0x" + parseTwapMessage(startUpdate.message).feedId.toString("hex")
      ] = twapUpdateKeypair.publicKey;
      closeInstructions.push(
        await this.buildCloseTwapUpdateInstruction(twapUpdateKeypair.publicKey),
      );
    }

    return {
      postInstructions,
      priceFeedIdToTwapUpdateAccount,
      closeInstructions,
    };
  }

  /**
   * Build a series of helper instructions that update one or many price feed accounts and another series to close the encoded vaa accounts used to update the price feed accounts.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @param shardId the shard ID of the set of price feed accounts. This shard ID allows for multiple price feed accounts for the same price feed id to exist.
   * @returns `postInstructions`: the instructions to update the price feed accounts. If the price feed accounts don't contain a recent update, these should be called before consuming the price updates.
   * @returns `priceFeedIdToPriceUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the price update. Note that since price feed accounts are PDAs, the address of the account can also be found with `getPriceFeedAccountAddress`.
   * @returns `closeInstructions`: the instructions to close the encoded VAA accounts that were used to update the price feed accounts.
   */
  async buildUpdatePriceFeedInstructions(
    priceUpdateDataArray: string[],
    shardId: number,
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    const treasuryId = this.treasuryId ?? getRandomTreasuryId();

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64"),
      );

      const {
        postInstructions: postEncodedVaaInstructions,
        encodedVaaAddress: encodedVaa,
        closeInstructions: postEncodedVaacloseInstructions,
      } = await this.buildPostEncodedVaaInstructions(accumulatorUpdateData.vaa);
      postInstructions.push(...postEncodedVaaInstructions);
      closeInstructions.push(...postEncodedVaacloseInstructions);

      for (const update of accumulatorUpdateData.updates) {
        const feedId = parsePriceFeedMessage(update.message).feedId;
        postInstructions.push({
          instruction: await this.pushOracle.methods
            .updatePriceFeed(
              {
                merklePriceUpdate: update,
                treasuryId,
              },
              shardId,
              Array.from(feedId),
            )
            .accounts({
              pythSolanaReceiver: this.receiver.programId,
              encodedVaa,
              priceFeedAccount: this.getPriceFeedAccountAddress(
                shardId,
                feedId,
              ),
              treasury: getTreasuryPda(treasuryId, this.receiver.programId),
              config: getConfigPda(this.receiver.programId),
            })
            .instruction(),
          signers: [],
          computeUnits: UPDATE_PRICE_FEED_COMPUTE_BUDGET,
        });

        priceFeedIdToPriceUpdateAccount[
          "0x" + parsePriceFeedMessage(update.message).feedId.toString("hex")
        ] = this.getPriceFeedAccountAddress(shardId, feedId);
      }
    }
    return {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    };
  }

  /**
   * Build a series of helper instructions that post a VAA in an encoded VAA account. This function is bespoke for posting Pyth VAAs and might not work for other usecases.
   *
   * @param vaa a Wormhole VAA
   * @returns `encodedVaaAddress`: the address of the encoded VAA account where the VAA will be posted
   * @returns `postInstructions`: the instructions to post the VAA
   * @returns `closeInstructions`: the instructions to close the encoded VAA account
   */
  async buildPostEncodedVaaInstructions(vaa: Buffer): Promise<{
    encodedVaaAddress: PublicKey;
    postInstructions: InstructionWithEphemeralSigners[];
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    return buildPostEncodedVaaInstructions(this.wormhole, vaa);
  }

  /**
   * Build an instruction to close an encoded VAA account, recovering the rent.
   */
  async buildCloseEncodedVaaInstruction(
    encodedVaa: PublicKey,
  ): Promise<InstructionWithEphemeralSigners> {
    return buildCloseEncodedVaaInstruction(this.wormhole, encodedVaa);
  }

  /**
   * Build aset of instructions to close all the existing encoded VAA accounts owned by this PythSolanaReceiver's wallet
   */
  async buildClosePreviousEncodedVaasInstructions(
    maxInstructions: number,
  ): Promise<InstructionWithEphemeralSigners[]> {
    const encodedVaas = await this.findOwnedEncodedVaaAccounts();
    const instructions = [];
    for (const encodedVaa of encodedVaas) {
      instructions.push(await this.buildCloseEncodedVaaInstruction(encodedVaa));
    }
    return instructions.slice(0, maxInstructions);
  }

  /**
   * Build an instruction to close a price update account, recovering the rent.
   */
  async buildClosePriceUpdateInstruction(
    priceUpdateAccount: PublicKey,
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.receiver.methods
      .reclaimRent()
      .accounts({ priceUpdateAccount })
      .instruction();
    return { instruction, signers: [] };
  }

  /**
   * Build an instruction to close a TWAP update account, recovering the rent.
   */
  async buildCloseTwapUpdateInstruction(
    twapUpdateAccount: PublicKey,
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.receiver.methods
      .reclaimTwapRent()
      .accounts({ twapUpdateAccount })
      .instruction();
    return { instruction, signers: [] };
  }

  /**
   * Returns a set of versioned transactions that contain the provided instructions in the same order and with efficient batching
   */
  async batchIntoVersionedTransactions(
    instructions: InstructionWithEphemeralSigners[],
    priorityFeeConfig: PriorityFeeConfig,
    addressLookupTable?: AddressLookupTableAccount,
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    return TransactionBuilder.batchIntoVersionedTransactions(
      this.wallet.publicKey,
      this.connection,
      instructions,
      priorityFeeConfig,
      addressLookupTable,
    );
  }

  /**
   * Fetch the contents of a price update account
   * @param priceUpdateAccount The address of the price update account
   * @returns The contents of the deserialized price update account or `null` if the account doesn't exist
   */
  async fetchPriceUpdateAccount(
    priceUpdateAccount: PublicKey,
  ): Promise<PriceUpdateAccount | null> {
    return this.receiver.account.priceUpdateV2.fetchNullable(
      priceUpdateAccount,
    );
  }

  /**
   * Fetch the contents of a price feed account
   * @param shardId The shard ID of the set of price feed accounts. This shard ID allows for multiple price feed accounts for the same price feed id to exist.
   * @param priceFeedId The price feed ID, as either a 32-byte buffer or hexadecimal string with or without a leading "0x" prefix.
   * @returns The contents of the deserialized price feed account or `null` if the account doesn't exist
   */
  async fetchPriceFeedAccount(
    shardId: number,
    priceFeedId: Buffer | string,
  ): Promise<PriceUpdateAccount | null> {
    return this.receiver.account.priceUpdateV2.fetchNullable(
      this.getPriceFeedAccountAddress(shardId, priceFeedId),
    );
  }

  /**
   * Derive the address of a price feed account
   * @param shardId The shard ID of the set of price feed accounts. This shard ID allows for multiple price feed accounts for the same price feed id to exist.
   * @param priceFeedId The price feed ID, as either a 32-byte buffer or hexadecimal string with or without a leading "0x" prefix.
   * @returns The address of the price feed account
   */
  getPriceFeedAccountAddress(
    shardId: number,
    priceFeedId: Buffer | string,
  ): PublicKey {
    return getPriceFeedAccountForProgram(
      shardId,
      priceFeedId,
      this.pushOracle.programId,
    );
  }

  /**
   * Find all the encoded VAA accounts owned by this PythSolanaReceiver's wallet
   * @returns a list of the public keys of the encoded VAA accounts
   */
  async findOwnedEncodedVaaAccounts() {
    return await findEncodedVaaAccountsByWriteAuthority(
      this.receiver.provider.connection,
      this.wallet.publicKey,
      this.wormhole.programId,
    );
  }
}

/**
 * Derive the address of a price feed account
 * @param shardId The shard ID of the set of price feed accounts. This shard ID allows for multiple price feed accounts for the same price feed id to exist.
 * @param priceFeedId The price feed ID, as either a 32-byte buffer or hexadecimal string with or without a leading "0x" prefix.
 * @param pushOracleProgramId The program ID of the Pyth Push Oracle program. If not provided, the default deployment will be used.
 * @returns The address of the price feed account
 */
export function getPriceFeedAccountForProgram(
  shardId: number,
  priceFeedId: Buffer | string,
  pushOracleProgramId?: PublicKey,
): PublicKey {
  if (typeof priceFeedId == "string") {
    if (priceFeedId.startsWith("0x")) {
      priceFeedId = Buffer.from(priceFeedId.slice(2), "hex");
    } else {
      priceFeedId = Buffer.from(priceFeedId, "hex");
    }
  }

  if (priceFeedId.length != 32) {
    throw new Error("Feed ID should be 32 bytes long");
  }
  const shardBuffer = Buffer.alloc(2);
  shardBuffer.writeUint16LE(shardId, 0);

  return PublicKey.findProgramAddressSync(
    [shardBuffer, priceFeedId],
    pushOracleProgramId ?? DEFAULT_PUSH_ORACLE_PROGRAM_ID,
  )[0];
}
