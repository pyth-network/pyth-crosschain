import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
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
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_TREASURY_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  getConfigPda,
  getGuardianSetPda,
  getTreasuryPda,
} from "./address";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
} from "@pythnetwork/price-service-sdk";
import {
  POST_UPDATE_ATOMIC_COMPUTE_BUDGET,
  POST_UPDATE_COMPUTE_BUDGET,
  VERIFY_ENCODED_VAA_COMPUTE_BUDGET,
} from "./compute_budget";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import {
  buildEncodedVaaCreateInstruction,
  buildWriteEncodedVaaWithSplitInstructions,
  getGuardianSetIndex,
  trimSignatures,
} from "./vaa";
import {
  TransactionBuilder,
  InstructionWithEphemeralSigners,
  PriorityFeeConfig,
} from "@pythnetwork/solana-utils";

/**
 * Configuration for the PythTransactionBuilder
 * @property closeUpdateAccounts (default: true) if true, the builder will add instructions to close the price update accounts and the encoded vaa accounts to recover the rent
 */
export type PythTransactionBuilderConfig = {
  closeUpdateAccounts?: boolean;
};

/**
 * A builder class to build transactions that:
 * - Post price updates (fully or partially verified)
 * - Consume price updates in a consumer program
 * - (Optionally) Close price update and encoded vaa accounts to recover the rent (`closeUpdateAccounts` in `PythTransactionBuilderConfig`)
 *
 * @example
 * ```typescript
 *  const priceUpdateData = await priceServiceConnection.getLatestVaas([
 *    SOL_PRICE_FEED_ID,
 *    ETH_PRICE_FEED_ID,
 *  ]);
 *
 * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
 * await transactionBuilder.addPostPriceUpdates(priceUpdateData);
 * await transactionBuilder.addPriceConsumerInstructions(...)
 *
 * await pythSolanaReceiver.provider.sendAll(await transactionBuilder.buildVersionedTransactions({computeUnitPriceMicroLamports:1000000}))
 * ```
 */
export class PythTransactionBuilder extends TransactionBuilder {
  readonly pythSolanaReceiver: PythSolanaReceiver;
  readonly closeInstructions: InstructionWithEphemeralSigners[];
  readonly priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
  readonly closeUpdateAccounts: boolean;

  constructor(
    pythSolanaReceiver: PythSolanaReceiver,
    config: PythTransactionBuilderConfig
  ) {
    super(pythSolanaReceiver.wallet.publicKey, pythSolanaReceiver.connection);
    this.pythSolanaReceiver = pythSolanaReceiver;
    this.closeInstructions = [];
    this.priceFeedIdToPriceUpdateAccount = {};
    this.closeUpdateAccounts = config.closeUpdateAccounts ?? true;
  }

  /**
   * Add instructions to post price updates to the builder.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   */
  async addPostPriceUpdates(priceUpdateDataArray: string[]) {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    } = await this.pythSolanaReceiver.buildPostPriceUpdateInstructions(
      priceUpdateDataArray
    );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToPriceUpdateAccount,
      priceFeedIdToPriceUpdateAccount
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions to post partially verified price updates to the builder.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   *
   * Partially verified price updates are price updates where not all the guardian signatures have been verified. By default this methods checks `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` signatures when posting the VAA.
   * If you are a on-chain program developer, make sure you understand the risks of consuming partially verified price updates here: {@link https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_sdk/src/price_update.rs}.
   *
   * @example
   * ```typescript
   * const priceUpdateData = await priceServiceConnection.getLatestVaas([
   *    SOL_PRICE_FEED_ID,
   *    ETH_PRICE_FEED_ID,
   * ]);
   *
   * const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
   * await transactionBuilder.addPostPartiallyVerifiedPriceUpdates(priceUpdateData);
   * await transactionBuilder.addPriceConsumerInstructions(...)
   * ...
   * ```
   */
  async addPostPartiallyVerifiedPriceUpdates(priceUpdateDataArray: string[]) {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      closeInstructions,
    } = await this.pythSolanaReceiver.buildPostPriceUpdateAtomicInstructions(
      priceUpdateDataArray
    );
    this.closeInstructions.push(...closeInstructions);
    Object.assign(
      this.priceFeedIdToPriceUpdateAccount,
      priceFeedIdToPriceUpdateAccount
    );
    this.addInstructions(postInstructions);
  }

  /**
   * Add instructions that consume price updates to the builder.
   *
   * @param getInstructions a function that given a mapping of price feed IDs to price update accounts, generates a series of instructions. Price updates get posted to ephemeral accounts and this function allows the user to indicate which accounts in their instruction need to be "replaced" with each price update account.
   * If multiple price updates for the same price feed id are posted with the same builder, the account corresponding to the last update to get posted will be used.
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
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey
    ) => Promise<InstructionWithEphemeralSigners[]>
  ) {
    this.addInstructions(
      await getInstructions(this.getPriceUpdateAccount.bind(this))
    );
  }

  /**
   * Returns all the added instructions batched into versioned transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  async buildVersionedTransactions(
    args: PriorityFeeConfig
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
    args: PriorityFeeConfig
  ): { tx: Transaction; signers: Signer[] }[] {
    if (this.closeUpdateAccounts) {
      this.addInstructions(this.closeInstructions);
    }
    return super.buildLegacyTransactions(args);
  }

  /**
   * This method is used to retrieve the address of the price update account where the price update for a given price feed id will be posted.
   * If multiple price updates for the same price feed id will be posted with the same builder, the address of the account corresponding to the last update to get posted will be returned.
   * */
  getPriceUpdateAccount(priceFeedId: string): PublicKey {
    const priceUpdateAccount =
      this.priceFeedIdToPriceUpdateAccount[priceFeedId];
    if (!priceUpdateAccount) {
      throw new Error(
        `No price update account found for the price feed ID ${priceFeedId}. Make sure to call addPostPriceUpdates or addPostPartiallyVerifiedPriceUpdates before calling this function.`
      );
    }
    return priceUpdateAccount;
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

  constructor({
    connection,
    wallet,
    wormholeProgramId = DEFAULT_WORMHOLE_PROGRAM_ID,
    receiverProgramId = DEFAULT_RECEIVER_PROGRAM_ID,
  }: {
    connection: Connection;
    wallet: Wallet;
    wormholeProgramId?: PublicKey;
    receiverProgramId?: PublicKey;
  }) {
    this.connection = connection;
    this.wallet = wallet;
    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: connection.commitment,
    });
    this.receiver = new Program<PythSolanaReceiverProgram>(
      Idl as PythSolanaReceiverProgram,
      receiverProgramId,
      this.provider
    );
    this.wormhole = new Program<WormholeCoreBridgeSolana>(
      WormholeCoreBridgeSolanaIdl as WormholeCoreBridgeSolana,
      wormholeProgramId,
      this.provider
    );
  }

  /**
   * Get a new transaction builder to build transactions that interact with the Pyth Solana Receiver program and consume price updates
   */
  newTransactionBuilder(
    config: PythTransactionBuilderConfig
  ): PythTransactionBuilder {
    return new PythTransactionBuilder(this, config);
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
    priceUpdateDataArray: string[]
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64")
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
              treasuryId: DEFAULT_TREASURY_ID,
            })
            .accounts({
              priceUpdateAccount: priceUpdateKeypair.publicKey,
              treasury: getTreasuryPda(
                DEFAULT_TREASURY_ID,
                this.receiver.programId
              ),
              config: getConfigPda(this.receiver.programId),
              guardianSet: getGuardianSetPda(
                guardianSetIndex,
                this.wormhole.programId
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
            priceUpdateKeypair.publicKey
          )
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
   * Build a series of helper instructions that post a VAA in an encoded VAA account. This function is bespoke for posting Pyth VAAs and might not work for other usecases.
   *
   * @param vaa a Wormhole VAA
   * @returns `postInstructions`: the instructions to post the VAA
   * @returns `encodedVaaAddress`: the address of the encoded VAA account where the VAA will be posted
   * @returns `closeInstructions`: the instructions to close the encoded VAA account
   */
  async buildPostEncodedVaaInstructions(vaa: Buffer): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    encodedVaaAddress: PublicKey;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const closeInstructions: InstructionWithEphemeralSigners[] = [];
    const encodedVaaKeypair = new Keypair();
    const guardianSetIndex = getGuardianSetIndex(vaa);

    postInstructions.push(
      await buildEncodedVaaCreateInstruction(
        this.wormhole,
        vaa,
        encodedVaaKeypair
      )
    );
    postInstructions.push({
      instruction: await this.wormhole.methods
        .initEncodedVaa()
        .accounts({
          encodedVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
    });

    postInstructions.push(
      ...(await buildWriteEncodedVaaWithSplitInstructions(
        this.wormhole,
        vaa,
        encodedVaaKeypair.publicKey
      ))
    );

    postInstructions.push({
      instruction: await this.wormhole.methods
        .verifyEncodedVaaV1()
        .accounts({
          guardianSet: getGuardianSetPda(
            guardianSetIndex,
            this.wormhole.programId
          ),
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
      computeUnits: VERIFY_ENCODED_VAA_COMPUTE_BUDGET,
    });

    closeInstructions.push(
      await this.buildCloseEncodedVaaInstruction(encodedVaaKeypair.publicKey)
    );

    return {
      postInstructions,
      encodedVaaAddress: encodedVaaKeypair.publicKey,
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
    priceUpdateDataArray: string[]
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    closeInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const closeInstructions: InstructionWithEphemeralSigners[] = [];

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64")
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
              treasuryId: DEFAULT_TREASURY_ID,
            })
            .accounts({
              encodedVaa,
              priceUpdateAccount: priceUpdateKeypair.publicKey,
              treasury: getTreasuryPda(
                DEFAULT_TREASURY_ID,
                this.receiver.programId
              ),
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
            priceUpdateKeypair.publicKey
          )
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
   * Build an instruction to close an encoded VAA account, recovering the rent.
   */
  async buildCloseEncodedVaaInstruction(
    encodedVaa: PublicKey
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.wormhole.methods
      .closeEncodedVaa()
      .accounts({ encodedVaa })
      .instruction();
    return { instruction, signers: [] };
  }

  /**
   * Build an instruction to close a price update account, recovering the rent.
   */
  async buildClosePriceUpdateInstruction(
    priceUpdateAccount: PublicKey
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.receiver.methods
      .reclaimRent()
      .accounts({ priceUpdateAccount })
      .instruction();
    return { instruction, signers: [] };
  }

  /**
   * Returns a set of versioned transactions that contain the provided instructions in the same order and with efficient batching
   */
  async batchIntoVersionedTransactions(
    instructions: InstructionWithEphemeralSigners[],
    priorityFeeConfig: PriorityFeeConfig
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    return TransactionBuilder.batchIntoVersionedTransactions(
      this.wallet.publicKey,
      this.connection,
      instructions,
      priorityFeeConfig
    );
  }
}
