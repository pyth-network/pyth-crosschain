import {
  AccountMeta,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID, getIxPDA } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  envOrErr,
  getCreateAccountWithSeedInstruction,
  getProposals,
  MultisigParser,
  PythMultisigInstruction,
  WormholeMultisigInstruction,
} from "xc_admin_common";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  deriveFeeCollectorKey,
  getWormholeBridgeData,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AccountType, parseProductData } from "@pythnetwork/client";

const CLUSTER: PythCluster = envOrErr("CLUSTER") as PythCluster;
const VAULT: PublicKey = new PublicKey(envOrErr("VAULT"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(getPythClusterApiUrl(CLUSTER), COMMITMENT),
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });
  const multisigParser = MultisigParser.fromCluster(CLUSTER);

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
          /// Add product, fetch the symbol from the instruction
          transaction.add(
            await getCreateAccountWithSeedInstruction(
              squad.connection,
              CLUSTER,
              squad.wallet.publicKey,
              parsedInstruction.args.symbol,
              AccountType.Product
            )
          );
        } else if (
          parsedInstruction instanceof PythMultisigInstruction &&
          parsedInstruction.name == "addPrice"
        ) {
          /// Add price, fetch the symbol from the product account
          const productAccount = await squad.connection.getAccountInfo(
            parsedInstruction.accounts.named.productAccount.pubkey
          );
          if (productAccount) {
            transaction.add(
              await getCreateAccountWithSeedInstruction(
                squad.connection,
                CLUSTER,
                squad.wallet.publicKey,
                parseProductData(productAccount.data).product.symbol,
                AccountType.Price
              )
            );
          } else {
            throw Error("Product account not found");
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
  try {
    await run();
  } catch (err) {
    console.error(err);
    throw new Error();
  }
})();
