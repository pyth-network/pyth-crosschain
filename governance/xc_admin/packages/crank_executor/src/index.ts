import {
  AccountMeta,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID, getIxPDA } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  getProposals,
  MultisigParser,
  PythMultisigInstruction,
  WormholeMultisigInstruction,
} from "xc_admin_common";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  deriveFeeCollectorKey,
  getWormholeBridgeData,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { parseProductData } from "@pythnetwork/client";

export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

const PRODUCT_ACCOUNT_SIZE = 512;
const PRICE_ACCOUNT_SIZE = 3312;

const CLUSTER: string = envOrErr("CLUSTER");
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";
const VAULT: PublicKey = new PublicKey(envOrErr("VAULT"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(
      getPythClusterApiUrl(CLUSTER as PythCluster),
      COMMITMENT
    ),
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });
  const multisigParser = MultisigParser.fromCluster(CLUSTER as PythCluster);

  const wormholeFee = multisigParser.wormholeBridgeAddress
    ? (
        await getWormholeBridgeData(
          squad.connection,
          multisigParser.wormholeBridgeAddress!,
          COMMITMENT
        )
      ).config.fee
    : 0;

  const proposals = await getProposals(squad, VAULT, undefined, "executeReady");

  for (const proposal of proposals) {
    console.log("Trying to execute: ", proposal.publicKey.toBase58());
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length == 0) {
      for (
        let i = proposal.executedIndex + 1;
        i <= proposal.instructionIndex;
        i++
      ) {
        const instructionPda = getIxPDA(
          proposal.publicKey,
          new BN(i),
          squad.multisigProgramId
        )[0];
        const instruction = await squad.getInstruction(instructionPda);
        const parsedInstruction = multisigParser.parseInstruction({
          programId: instruction.programId,
          data: instruction.data as Buffer,
          keys: instruction.keys as AccountMeta[],
        });
        const transaction = new Transaction();

        if (
          parsedInstruction instanceof WormholeMultisigInstruction &&
          parsedInstruction.name == "postMessage"
        ) {
          transaction.add(
            SystemProgram.transfer({
              lamports: wormholeFee,
              toPubkey: deriveFeeCollectorKey(
                multisigParser.wormholeBridgeAddress!
              ),
              fromPubkey: squad.wallet.publicKey,
            })
          );
        } else if (
          parsedInstruction instanceof PythMultisigInstruction &&
          parsedInstruction.name == "addProduct"
        ) {
          /// Add product, fetch the symbol from updProduct to get the address
          i += 1;
          const nextInstructionPda = getIxPDA(
            proposal.publicKey,
            new BN(i),
            squad.multisigProgramId
          )[0];
          const nextInstruction = await squad.getInstruction(
            nextInstructionPda
          );
          const nextParsedInstruction = multisigParser.parseInstruction({
            programId: nextInstruction.programId,
            data: nextInstruction.data as Buffer,
            keys: nextInstruction.keys as AccountMeta[],
          });

          if (
            nextParsedInstruction instanceof PythMultisigInstruction &&
            nextParsedInstruction.name == "updProduct"
          ) {
            const productSeed = "product:" + nextParsedInstruction.args.symbol;
            const productAddress = await PublicKey.createWithSeed(
              squad.wallet.publicKey,
              productSeed,
              getPythProgramKeyForCluster(CLUSTER as PythCluster)
            );
            transaction.add(
              SystemProgram.createAccountWithSeed({
                fromPubkey: squad.wallet.publicKey,
                basePubkey: squad.wallet.publicKey,
                newAccountPubkey: productAddress,
                seed: productSeed,
                space: PRODUCT_ACCOUNT_SIZE,
                lamports:
                  await squad.connection.getMinimumBalanceForRentExemption(
                    PRODUCT_ACCOUNT_SIZE
                  ),
                programId: getPythProgramKeyForCluster(CLUSTER as PythCluster),
              })
            );
            transaction.add(
              await squad.buildExecuteInstruction(
                proposal.publicKey,
                getIxPDA(
                  proposal.publicKey,
                  new BN(i - 1),
                  squad.multisigProgramId
                )[0]
              )
            );
          }
        } else if (
          parsedInstruction instanceof PythMultisigInstruction &&
          parsedInstruction.name == "addPrice"
        ) {
          /// Add price, fetch the symbol from the product account
          const productAccount = await squad.connection.getAccountInfo(
            parsedInstruction.accounts.named.productAccount.pubkey
          );
          if (productAccount?.data) {
            const priceSeed =
              "price:" + parseProductData(productAccount.data).product.symbol;
            const priceAddress = await PublicKey.createWithSeed(
              squad.wallet.publicKey,
              priceSeed,
              getPythProgramKeyForCluster(CLUSTER as PythCluster)
            );
            transaction.add(
              SystemProgram.createAccountWithSeed({
                fromPubkey: squad.wallet.publicKey,
                basePubkey: squad.wallet.publicKey,
                newAccountPubkey: priceAddress,
                seed: priceSeed,
                space: PRICE_ACCOUNT_SIZE,
                lamports:
                  await squad.connection.getMinimumBalanceForRentExemption(
                    PRICE_ACCOUNT_SIZE
                  ),
                programId: getPythProgramKeyForCluster(CLUSTER as PythCluster),
              })
            );
          }
        }

        transaction.add(
          await squad.buildExecuteInstruction(
            proposal.publicKey,
            getIxPDA(proposal.publicKey, new BN(i), squad.multisigProgramId)[0]
          )
        );

        await new AnchorProvider(squad.connection, squad.wallet, {
          commitment: COMMITMENT,
          preflightCommitment: COMMITMENT,
        }).sendAndConfirm(transaction, [], { skipPreflight: true });
      }
    } else {
      console.log("Skipping: ", proposal.publicKey.toBase58());
    }
  }
}

(async () => {
  await run();
})();
