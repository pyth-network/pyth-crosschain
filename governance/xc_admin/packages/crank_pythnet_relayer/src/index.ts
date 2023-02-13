import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { parseProductData } from "@pythnetwork/client";
import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  AccountMeta,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import * as fs from "fs";
import {
  decodeGovernancePayload,
  ExecutePostedVaa,
  MultisigParser,
  PythMultisigInstruction,
  WORMHOLE_ADDRESS,
  WORMHOLE_API_ENDPOINT,
} from "xc_admin_common";

export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

const REMOTE_EXECUTOR_ADDRESS = new PublicKey(
  "exe6S3AxPVNmy46L4Nj6HrnnAVQUhwyYzMSNcnRn3qq"
);

const PRODUCT_ACCOUNT_SIZE = 512;
const PRICE_ACCOUNT_SIZE = 3312;
const CLAIM_RECORD_SEED = "CLAIM_RECORD";
const EXECUTOR_KEY_SEED = "EXECUTOR_KEY";
const CLUSTER: PythCluster = envOrErr("CLUSTER") as PythCluster;
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";
const OFFSET: number = Number(process.env.OFFSET ?? "-1");
const EMITTER: PublicKey = new PublicKey(envOrErr("EMITTER"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);

async function run() {
  const provider = new AnchorProvider(
    new Connection(getPythClusterApiUrl(CLUSTER), COMMITMENT),
    new NodeWallet(KEYPAIR),
    {
      commitment: COMMITMENT,
      preflightCommitment: COMMITMENT,
    }
  );

  const remoteExecutor = await Program.at(REMOTE_EXECUTOR_ADDRESS, provider);

  const claimRecordAddress: PublicKey = PublicKey.findProgramAddressSync(
    [Buffer.from(CLAIM_RECORD_SEED), EMITTER.toBuffer()],
    remoteExecutor.programId
  )[0];
  const executorKey: PublicKey = PublicKey.findProgramAddressSync(
    [Buffer.from(EXECUTOR_KEY_SEED), EMITTER.toBuffer()],
    remoteExecutor.programId
  )[0];
  const claimRecord = await remoteExecutor.account.claimRecord.fetchNullable(
    claimRecordAddress
  );
  let lastSequenceNumber: number = claimRecord
    ? (claimRecord.sequence as BN).toNumber()
    : -1;
  lastSequenceNumber = Math.max(lastSequenceNumber, OFFSET);
  const wormholeApi = WORMHOLE_API_ENDPOINT[CLUSTER];

  while (true) {
    lastSequenceNumber += 1;
    console.log(`Trying sequence number : ${lastSequenceNumber}`);

    const response = await (
      await fetch(
        `${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex"
        )}/${lastSequenceNumber}`
      )
    ).json();

    if (response.vaaBytes) {
      const vaa = parseVaa(Buffer.from(response.vaaBytes, "base64"));
      const governancePayload = decodeGovernancePayload(vaa.payload);

      if (
        governancePayload instanceof ExecutePostedVaa &&
        governancePayload.targetChainId == "pythnet"
      ) {
        const multisigParser = MultisigParser.fromCluster(CLUSTER);
        const preInstructions: TransactionInstruction[] = [];

        console.log(`Found VAA ${lastSequenceNumber}, relaying ...`);
        await postVaaSolana(
          provider.connection,
          signTransactionFactory(KEYPAIR),
          WORMHOLE_ADDRESS[CLUSTER]!,
          provider.wallet.publicKey,
          Buffer.from(response.vaaBytes, "base64"),
          { commitment: COMMITMENT }
        );

        let extraAccountMetas: AccountMeta[] = [
          { pubkey: executorKey, isSigner: false, isWritable: true },
        ];

        for (const ix of governancePayload.instructions) {
          extraAccountMetas.push({
            pubkey: ix.programId,
            isSigner: false,
            isWritable: false,
          });
          extraAccountMetas.push(
            ...ix.keys.filter((acc) => {
              return !acc.pubkey.equals(executorKey);
            })
          );

          const parsedInstruction = multisigParser.parseInstruction(ix);
          if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addProduct"
          ) {
            const productSeed = "product:" + parsedInstruction.args.symbol;
            const productAddress = await PublicKey.createWithSeed(
              provider.wallet.publicKey,
              productSeed,
              getPythProgramKeyForCluster(CLUSTER as PythCluster)
            );
            preInstructions.push(
              SystemProgram.createAccountWithSeed({
                fromPubkey: provider.wallet.publicKey,
                basePubkey: provider.wallet.publicKey,
                newAccountPubkey: productAddress,
                seed: productSeed,
                space: PRODUCT_ACCOUNT_SIZE,
                lamports:
                  await provider.connection.getMinimumBalanceForRentExemption(
                    PRODUCT_ACCOUNT_SIZE
                  ),
                programId: getPythProgramKeyForCluster(CLUSTER as PythCluster),
              })
            );
          } else if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addPrice"
          ) {
            const productAccount = await provider.connection.getAccountInfo(
              parsedInstruction.accounts.named.productAccount.pubkey
            );
            if (productAccount) {
              const priceSeed =
                "price:" + parseProductData(productAccount.data).product.symbol;
              const priceAddress = await PublicKey.createWithSeed(
                provider.wallet.publicKey,
                priceSeed,
                getPythProgramKeyForCluster(CLUSTER as PythCluster)
              );
              preInstructions.push(
                SystemProgram.createAccountWithSeed({
                  fromPubkey: provider.wallet.publicKey,
                  basePubkey: provider.wallet.publicKey,
                  newAccountPubkey: priceAddress,
                  seed: priceSeed,
                  space: PRICE_ACCOUNT_SIZE,
                  lamports:
                    await provider.connection.getMinimumBalanceForRentExemption(
                      PRICE_ACCOUNT_SIZE
                    ),
                  programId: getPythProgramKeyForCluster(
                    CLUSTER as PythCluster
                  ),
                })
              );
            } else {
              throw Error("Product account not found");
            }
          }
        }

        await remoteExecutor.methods
          .executePostedVaa()
          .accounts({
            claimRecord: claimRecordAddress,
            postedVaa: derivePostedVaaKey(WORMHOLE_ADDRESS[CLUSTER]!, vaa.hash),
          })
          .remainingAccounts(extraAccountMetas)
          .preInstructions(preInstructions)
          .rpc();
      }
    } else if (response.code == 5) {
      console.log(`Wormhole API failure`);
      console.log(
        `${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex"
        )}/${lastSequenceNumber}`
      );
      break;
    } else {
      throw new Error("Could not connect to wormhole api");
    }
  }
}

(async () => {
  await run();
})();
