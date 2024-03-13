import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Signer, VersionedTransaction } from "@solana/web3.js";
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
 * A class to interact with the Pyth Solana Receiver program.
 *
 * This class provides helpful methods to:
 * - Post price updates from Pythnet to the Pyth Solana Receiver program
 * - Consume price updates in a consumer program
 * - Cleanup price update accounts to recover rent
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
   * Build a series of transactions that post price updates to the Pyth Solana Receiver program, consume them in a consumer program and cleanup the encoded vaa accounts and price update accounts.
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @param getInstructions a function that given a map of price feed IDs to price update accounts, returns a series of instructions to consume the price updates in a consumer program. This function is a way for the user to indicate which accounts in their instruction need to be "replaced" with price update accounts.
   * @param priorityFeeConfig a configuration for the compute unit price to use for the transactions.
   * @returns an array of transactions and their corresponding ephemeral signers
   */
  async withPriceUpdate(
    priceUpdateDataArray: string[],
    getInstructions: (
      priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>
    ) => Promise<InstructionWithEphemeralSigners[]>,
    priorityFeeConfig?: PriorityFeeConfig
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount: priceFeedIdToPriceUpdateAccount,
      cleanupInstructions,
    } = await this.buildPostPriceUpdateInstructions(priceUpdateDataArray);
    return this.batchIntoVersionedTransactions(
      [
        ...postInstructions,
        ...(await getInstructions(priceFeedIdToPriceUpdateAccount)),
        ...cleanupInstructions,
      ],
      priorityFeeConfig ?? {}
    );
  }

  /**
   * Build a series of transactions that post partially verified price updates to the Pyth Solana Receiver program, consume them in a consumer program and cleanup the price update accounts.
   *
   * Partially verified price updates are price updates where not all the guardian signatures have been verified. By default this methods checks `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` signatures when posting the VAA.
   * If you are a on-chain program developer, make sure you understand the risks of consuming partially verified price updates here: {@link https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_state/src/price_update.rs}.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @param getInstructions a function that given a map of price feed IDs to price update accounts, returns a series of instructions to consume the price updates in a consumer program. This function is a way for the user to indicate which accounts in their instruction need to be "replaced" with price update accounts.
   * @param priorityFeeConfig a configuration for the compute unit price to use for the transactions.
   * @returns an array of transactions and their corresponding ephemeral signers
   */
  async withPartiallyVerifiedPriceUpdate(
    priceUpdateDataArray: string[],
    getInstructions: (
      priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>
    ) => Promise<InstructionWithEphemeralSigners[]>,
    priorityFeeConfig?: PriorityFeeConfig
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      cleanupInstructions,
    } = await this.buildPostPriceUpdateAtomicInstructions(priceUpdateDataArray);
    return this.batchIntoVersionedTransactions(
      [
        ...postInstructions,
        ...(await getInstructions(priceFeedIdToPriceUpdateAccount)),
        ...cleanupInstructions,
      ],
      priorityFeeConfig ?? {}
    );
  }

  /**
   * Build a series of helper instructions that post price updates to the Pyth Solana Receiver program and another series to clean up the price update accounts.
   *
   * This function uses partially verified price updates. Partially verified price updates are price updates where not all the guardian signatures have been verified. By default this methods checks `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` signatures when posting the VAA.
   * If you are a on-chain program developer, make sure you understand the risks of consuming partially verified price updates here: {@link https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_state/src/price_update.rs}.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @returns `postInstructions`: the instructions to post the price updates, these should be called before consuming the price updates
   * @returns `priceFeedIdToPriceUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the price update.
   * @returns `cleanupInstructions`: the instructions to clean up the price update accounts, these should be called after consuming the price updates
   */
  async buildPostPriceUpdateAtomicInstructions(
    priceUpdateDataArray: string[]
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    cleanupInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const cleanupInstructions: InstructionWithEphemeralSigners[] = [];

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

        cleanupInstructions.push(
          await this.buildClosePriceUpdateInstruction(
            priceUpdateKeypair.publicKey
          )
        );
      }
    }
    return {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      cleanupInstructions,
    };
  }

  /**
   * Build a series of helper instructions that post a VAA in an encoded VAA account. This function is bespoke for posting Pyth VAAs and might not work for other usecases.
   *
   * @param vaa a Wormhole VAA
   * @returns `postInstructions`: the instructions to post the VAA
   * @returns `encodedVaaAddress`: the address of the encoded VAA account where the VAA will be posted
   * @returns `cleanupInstructions`: the instructions to clean up the encoded VAA account
   */
  async buildPostEncodedVaaInstructions(vaa: Buffer): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    encodedVaaAddress: PublicKey;
    cleanupInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const cleanupInstructions: InstructionWithEphemeralSigners[] = [];
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

    cleanupInstructions.push(
      await this.buildCloseEncodedVaaInstruction(encodedVaaKeypair.publicKey)
    );

    return {
      postInstructions,
      encodedVaaAddress: encodedVaaKeypair.publicKey,
      cleanupInstructions,
    };
  }

  /**
   * Build a series of helper instructions that post price updates to the Pyth Solana Receiver program and another series to clean up the encoded vaa accounts and the price update accounts.
   *
   * @param priceUpdateDataArray the output of the `@pythnetwork/price-service-client`'s `PriceServiceConnection.getLatestVaas`. This is an array of verifiable price updates.
   * @returns `postInstructions`: the instructions to post the price updates, these should be called before consuming the price updates
   * @returns `priceFeedIdToPriceUpdateAccount`: this is a map of price feed IDs to Solana address. Given a price feed ID, you can use this map to find the account where `postInstructions` will post the price update.
   * @returns `cleanupInstructions`: the instructions to clean up the price update accounts, these should be called after consuming the price updates
   */
  async buildPostPriceUpdateInstructions(
    priceUpdateDataArray: string[]
  ): Promise<{
    postInstructions: InstructionWithEphemeralSigners[];
    priceFeedIdToPriceUpdateAccount: Record<string, PublicKey>;
    cleanupInstructions: InstructionWithEphemeralSigners[];
  }> {
    const postInstructions: InstructionWithEphemeralSigners[] = [];
    const priceFeedIdToPriceUpdateAccount: Record<string, PublicKey> = {};
    const cleanupInstructions: InstructionWithEphemeralSigners[] = [];

    for (const priceUpdateData of priceUpdateDataArray) {
      const accumulatorUpdateData = parseAccumulatorUpdateData(
        Buffer.from(priceUpdateData, "base64")
      );

      const {
        postInstructions: postEncodedVaaInstructions,
        encodedVaaAddress: encodedVaa,
        cleanupInstructions: postEncodedVaaCleanupInstructions,
      } = await this.buildPostEncodedVaaInstructions(accumulatorUpdateData.vaa);
      postInstructions.push(...postEncodedVaaInstructions);
      cleanupInstructions.push(...postEncodedVaaCleanupInstructions);

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
        cleanupInstructions.push(
          await this.buildClosePriceUpdateInstruction(
            priceUpdateKeypair.publicKey
          )
        );
      }
    }

    return {
      postInstructions,
      priceFeedIdToPriceUpdateAccount,
      cleanupInstructions,
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
