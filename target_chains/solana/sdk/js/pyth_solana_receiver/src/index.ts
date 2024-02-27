import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Signer,
  TransactionInstruction,
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
import {
  DEFAULT_REDUCED_GUARDIAN_SET_SIZE,
  DEFAULT_TREASURY_ID,
  VAA_SPLIT_INDEX,
  VAA_START,
} from "./constants";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { getGuardianSetIndex, trimSignatures } from "./vaa";
import { TransactionBuilder } from "@pythnetwork/solana-utils";

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
      commitment: connection.commitment,
    });
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

  async withPriceUpdate(
    vaa: string,
    getInstructions: (
      priceFeedIdToPriceUpdateAccount: Record<number, PublicKey>
    ) => Promise<{ instruction: TransactionInstruction; signers: Signer[] }[]>
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const builder = new TransactionBuilder(
      this.wallet.publicKey,
      this.connection
    );
    const { instructions, priceFeedIdToPriceAccount, encodedVaaAddress } =
      await this.buildPostPriceUpdateInstructions(vaa);
    builder.addInstructions(instructions);
    builder.addInstructions(await getInstructions(priceFeedIdToPriceAccount));
    builder.addInstruction(await this.buildCloseEncodedVaa(encodedVaaAddress));
    builder.addInstruction(
      await this.buildClosePriceUpdate(
        Object.values(priceFeedIdToPriceAccount)[0]
      )
    );
    return builder.getVersionedTransactions();
  }

  async withPartiallyVerifiedPriceUpdate(
    vaa: string,
    getInstructions: (
      priceFeedIdToPriceUpdateAccount: Record<number, PublicKey>
    ) => Promise<{ instruction: TransactionInstruction; signers: Signer[] }[]>
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const builder = new TransactionBuilder(
      this.wallet.publicKey,
      this.connection
    );
    const { instructions, priceFeedIdToPriceAccount } =
      await this.buildPostPriceUpdateAtomicInstructions(vaa);
    builder.addInstructions(instructions);
    builder.addInstructions(await getInstructions(priceFeedIdToPriceAccount));
    builder.addInstruction(
      await this.buildClosePriceUpdate(
        Object.values(priceFeedIdToPriceAccount)[0]
      )
    );
    return builder.getVersionedTransactions();
  }

  async buildPostPriceUpdateAtomicInstructions(vaa: string): Promise<{
    instructions: [{ instruction: TransactionInstruction; signers: Signer[] }];
    priceFeedIdToPriceAccount: Record<string, PublicKey>;
  }> {
    const accumulatorUpdateData = parseAccumulatorUpdateData(
      Buffer.from(vaa, "base64")
    );
    const guardianSetIndex = getGuardianSetIndex(accumulatorUpdateData.vaa);
    const trimmedVaa = trimSignatures(
      accumulatorUpdateData.vaa,
      DEFAULT_REDUCED_GUARDIAN_SET_SIZE
    );
    const priceUpdateKeypair = new Keypair();
    return {
      instructions: [
        {
          instruction: await this.receiver.methods
            .postUpdateAtomic({
              vaa: trimmedVaa,
              merklePriceUpdate: accumulatorUpdateData.updates[0],
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
        },
      ],
      priceFeedIdToPriceAccount: { 0: priceUpdateKeypair.publicKey },
    };
  }

  async buildPostPriceUpdateInstructions(vaa: string): Promise<{
    instructions: { instruction: TransactionInstruction; signers: Signer[] }[];
    priceFeedIdToPriceAccount: Record<string, PublicKey>;
    encodedVaaAddress: PublicKey;
  }> {
    const accumulatorUpdateData = parseAccumulatorUpdateData(
      Buffer.from(vaa, "base64")
    );

    const encodedVaaKeypair = new Keypair();
    const encodedVaaSize = accumulatorUpdateData.vaa.length + VAA_START;

    const guardianSetIndex = getGuardianSetIndex(accumulatorUpdateData.vaa);

    const instructions: {
      instruction: TransactionInstruction;
      signers: Signer[];
    }[] = [];

    instructions.push({
      instruction: await this.wormhole.account.encodedVaa.createInstruction(
        encodedVaaKeypair,
        encodedVaaSize
      ),
      signers: [encodedVaaKeypair],
    });

    instructions.push({
      instruction: await this.wormhole.methods
        .initEncodedVaa()
        .accounts({
          encodedVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
    });

    instructions.push({
      instruction: await this.wormhole.methods
        .writeEncodedVaa({
          index: 0,
          data: accumulatorUpdateData.vaa.subarray(0, VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
    });

    const priceUpdateKeypair = new Keypair();

    instructions.push({
      instruction: await this.wormhole.methods
        .writeEncodedVaa({
          index: VAA_SPLIT_INDEX,
          data: accumulatorUpdateData.vaa.subarray(VAA_SPLIT_INDEX),
        })
        .accounts({
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
    });

    instructions.push({
      instruction: await this.wormhole.methods
        .verifyEncodedVaaV1()
        .accounts({
          guardianSet: getGuardianSetPda(guardianSetIndex),
          draftVaa: encodedVaaKeypair.publicKey,
        })
        .instruction(),
      signers: [],
    });

    instructions.push({
      instruction: await this.receiver.methods
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
        .instruction(),
      signers: [priceUpdateKeypair],
    });

    return {
      instructions,
      priceFeedIdToPriceAccount: { 0: priceUpdateKeypair.publicKey },
      encodedVaaAddress: encodedVaaKeypair.publicKey,
    };
  }

  async buildCloseEncodedVaa(
    encodedVaa: PublicKey
  ): Promise<{ instruction: TransactionInstruction; signers: Signer[] }> {
    const instruction = await this.wormhole.methods
      .closeEncodedVaa()
      .accounts({ encodedVaa })
      .instruction();
    return { instruction, signers: [] };
  }

  async buildClosePriceUpdate(
    priceUpdateAccount: PublicKey
  ): Promise<{ instruction: TransactionInstruction; signers: Signer[] }> {
    const instruction = await this.receiver.methods
      .reclaimRent()
      .accounts({ priceUpdateAccount })
      .instruction();
    return { instruction, signers: [] };
  }
}
