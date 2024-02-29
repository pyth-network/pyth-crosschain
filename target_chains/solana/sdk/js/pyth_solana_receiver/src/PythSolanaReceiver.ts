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
} from "@pythnetwork/solana-utils";
import { PriorityFeeConfig } from "@pythnetwork/solana-utils/lib/transaction";

export const DEFAULT_TREASURY_ID = 0;

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
    return TransactionBuilder.batchIntoVersionedTransactions(
      this.wallet.publicKey,
      this.connection,
      [
        ...postInstructions,
        ...(await getInstructions(priceFeedIdToPriceUpdateAccount)),
        ...cleanupInstructions,
      ],
      priorityFeeConfig ?? {}
    );
  }

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
    return TransactionBuilder.batchIntoVersionedTransactions(
      this.wallet.publicKey,
      this.connection,
      [
        ...postInstructions,
        ...(await getInstructions(priceFeedIdToPriceUpdateAccount)),
        ...cleanupInstructions,
      ],
      priorityFeeConfig ?? {}
    );
  }

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
              treasury: getTreasuryPda(DEFAULT_TREASURY_ID),
              config: getConfigPda(),
              guardianSet: getGuardianSetPda(guardianSetIndex),
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
          guardianSet: getGuardianSetPda(guardianSetIndex),
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
              treasury: getTreasuryPda(DEFAULT_TREASURY_ID),
              config: getConfigPda(),
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

  async buildCloseEncodedVaaInstruction(
    encodedVaa: PublicKey
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.wormhole.methods
      .closeEncodedVaa()
      .accounts({ encodedVaa })
      .instruction();
    return { instruction, signers: [] };
  }

  async buildClosePriceUpdateInstruction(
    priceUpdateAccount: PublicKey
  ): Promise<InstructionWithEphemeralSigners> {
    const instruction = await this.receiver.methods
      .reclaimRent()
      .accounts({ priceUpdateAccount })
      .instruction();
    return { instruction, signers: [] };
  }
}
