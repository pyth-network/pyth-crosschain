import * as fs from "node:fs";
import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import type { BN } from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AccountType, parseProductData } from "@pythnetwork/client";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import {
  CLAIM_RECORD_SEED,
  createDeterministicPublisherBufferAccountInstruction,
  decodeGovernancePayload,
  ExecutePostedVaa,
  envOrErr,
  getCreateAccountWithSeedInstruction,
  MultisigParser,
  mapKey,
  PriceStoreMultisigInstruction,
  PythMultisigInstruction,
  REMOTE_EXECUTOR_ADDRESS,
  WORMHOLE_ADDRESS,
  WORMHOLE_API_ENDPOINT,
} from "@pythnetwork/xc-admin-common";
import type {
  AccountMeta,
  Commitment,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

const CLUSTER: PythCluster = envOrErr("CLUSTER") as PythCluster;
const EMITTER: PublicKey = new PublicKey(envOrErr("EMITTER"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii"))),
);
const OFFSET: number = Number(process.env.OFFSET ?? "-1");
const SKIP_FAILED_REMOTE_INSTRUCTIONS: boolean =
  process.env.SKIP_FAILED_REMOTE_INSTRUCTIONS == "true";
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";

const GUARDIAN_RPC = process.env.GUARDIAN_RPC;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

async function run() {
  const provider = new AnchorProvider(
    new Connection(SOLANA_RPC_URL ?? getPythClusterApiUrl(CLUSTER), COMMITMENT),
    new NodeWallet(KEYPAIR),
    {
      commitment: COMMITMENT,
      preflightCommitment: COMMITMENT,
    },
  );
  const multisigParser = MultisigParser.fromCluster(CLUSTER);

  const remoteExecutor = await Program.at(REMOTE_EXECUTOR_ADDRESS, provider);

  const claimRecordAddress: PublicKey = PublicKey.findProgramAddressSync(
    [Buffer.from(CLAIM_RECORD_SEED), EMITTER.toBuffer()],
    remoteExecutor.programId,
  )[0];
  const executorKey: PublicKey = mapKey(EMITTER);
  const claimRecord =
    await remoteExecutor.account.claimRecord?.fetchNullable(claimRecordAddress);
  let lastSequenceNumber: number = claimRecord
    ? (claimRecord.sequence as BN).toNumber()
    : -1;
  lastSequenceNumber = Math.max(lastSequenceNumber, OFFSET);
  const wormholeApi = GUARDIAN_RPC ?? WORMHOLE_API_ENDPOINT[CLUSTER];
  const productAccountToSymbol: { [key: string]: string } = {};
  while (true) {
    lastSequenceNumber += 1;

    const response = (await (
      await fetch(
        `${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex",
        )}/${lastSequenceNumber}`,
      )
    ).json()) as Partial<{ code: number; vaaBytes: string }>;

    if (response.vaaBytes) {
      const vaa = parseVaa(Buffer.from(response.vaaBytes, "base64"));
      const governancePayload = decodeGovernancePayload(vaa.payload);

      if (
        governancePayload instanceof ExecutePostedVaa &&
        governancePayload.targetChainId == "pythnet"
      ) {
        const preInstructions: TransactionInstruction[] = [];

        await postVaaSolana(
          provider.connection,
          signTransactionFactory(KEYPAIR),
          WORMHOLE_ADDRESS[CLUSTER]!,
          provider.wallet.publicKey,
          Buffer.from(response.vaaBytes, "base64"),
          { commitment: COMMITMENT },
        );

        const extraAccountMetas: AccountMeta[] = [
          { isSigner: false, isWritable: true, pubkey: executorKey },
        ];

        for (const ix of governancePayload.instructions) {
          extraAccountMetas.push({
            isSigner: false,
            isWritable: false,
            pubkey: ix.programId,
          });
          extraAccountMetas.push(
            ...ix.keys.filter((acc) => {
              return !acc.pubkey.equals(executorKey);
            }),
          );

          const parsedInstruction = multisigParser.parseInstruction(ix);

          if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addProduct"
          ) {
            preInstructions.push(
              await getCreateAccountWithSeedInstruction(
                provider.connection,
                CLUSTER,
                provider.wallet.publicKey,
                parsedInstruction.args.symbol,
                AccountType.Product,
              ),
            );
            productAccountToSymbol[
              parsedInstruction.accounts.named.productAccount?.pubkey.toBase58()
            ] = parsedInstruction.args.symbol;
          } else if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addPrice"
          ) {
            const productAccount = await provider.connection.getAccountInfo(
              parsedInstruction.accounts.named.productAccount?.pubkey,
            );
            const productSymbol = productAccount
              ? parseProductData(productAccount.data).product.symbol
              : productAccountToSymbol[
                  parsedInstruction.accounts.named.productAccount?.pubkey.toBase58()
                ];
            if (productSymbol) {
              preInstructions.push(
                await getCreateAccountWithSeedInstruction(
                  provider.connection,
                  CLUSTER,
                  provider.wallet.publicKey,
                  productSymbol,
                  AccountType.Price,
                ),
              );
            } else {
              throw new Error("Product account not found");
            }
          } else if (
            parsedInstruction instanceof PriceStoreMultisigInstruction &&
            parsedInstruction.name == "InitializePublisher"
          ) {
            preInstructions.push(
              await createDeterministicPublisherBufferAccountInstruction(
                provider.connection,
                provider.wallet.publicKey,
                parsedInstruction.args.publisherKey,
              ),
            );
          }
        }

        try {
          await remoteExecutor.methods
            .executePostedVaa?.()
            .accounts({
              claimRecord: claimRecordAddress,
              postedVaa: derivePostedVaaKey(
                WORMHOLE_ADDRESS[CLUSTER]!,
                vaa.hash,
              ),
            })
            .remainingAccounts(extraAccountMetas)
            .preInstructions(preInstructions)
            // Use a high compute unit limit to avoid running out of compute units
            // as some operations can use a lot of compute units.
            .postInstructions([
              ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
            ])
            .rpc({ skipPreflight: false });
        } catch (e) {
          if (SKIP_FAILED_REMOTE_INSTRUCTIONS) {
          } else throw e;
        }
      }
    } else if (response.code == 5) {
      break;
    } else {
      throw new Error("Could not connect to wormhole api");
    }
  }
}

(async () => {
  try {
    await run();
  } catch (_err) {
    throw new Error();
  }
})();
