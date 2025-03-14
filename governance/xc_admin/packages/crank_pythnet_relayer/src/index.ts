import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AccountType, parseProductData } from "@pythnetwork/client";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  AccountMeta,
  Commitment,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import * as fs from "fs";
import {
  decodeGovernancePayload,
  ExecutePostedVaa,
  getCreateAccountWithSeedInstruction,
  MultisigParser,
  PythMultisigInstruction,
  WORMHOLE_ADDRESS,
  WORMHOLE_API_ENDPOINT,
  CLAIM_RECORD_SEED,
  mapKey,
  REMOTE_EXECUTOR_ADDRESS,
  envOrErr,
  PriceStoreMultisigInstruction,
  createDeterministicPublisherBufferAccountInstruction,
} from "@pythnetwork/xc-admin-common";

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
    await remoteExecutor.account.claimRecord.fetchNullable(claimRecordAddress);
  let lastSequenceNumber: number = claimRecord
    ? (claimRecord.sequence as BN).toNumber()
    : -1;
  lastSequenceNumber = Math.max(lastSequenceNumber, OFFSET);
  const wormholeApi = GUARDIAN_RPC ?? WORMHOLE_API_ENDPOINT[CLUSTER];
  const productAccountToSymbol: { [key: string]: string } = {};
  while (true) {
    lastSequenceNumber += 1;
    console.log(`Trying sequence number : ${lastSequenceNumber}`);

    const response = await (
      await fetch(
        `${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex",
        )}/${lastSequenceNumber}`,
      )
    ).json();

    if (response.vaaBytes) {
      const vaa = parseVaa(Buffer.from(response.vaaBytes, "base64"));
      const governancePayload = decodeGovernancePayload(vaa.payload);

      if (
        governancePayload instanceof ExecutePostedVaa &&
        governancePayload.targetChainId == "pythnet"
      ) {
        const preInstructions: TransactionInstruction[] = [];

        console.log(`Found VAA ${lastSequenceNumber}, relaying vaa ...`);

        await postVaaSolana(
          provider.connection,
          signTransactionFactory(KEYPAIR),
          WORMHOLE_ADDRESS[CLUSTER]!,
          provider.wallet.publicKey,
          Buffer.from(response.vaaBytes, "base64"),
          { commitment: COMMITMENT },
        );

        console.log(`VAA ${lastSequenceNumber} relayed. executing ...`);

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
            }),
          );

          const parsedInstruction = multisigParser.parseInstruction(ix);

          console.log("Parsed instruction:");
          console.dir(parsedInstruction, { depth: null });

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
              parsedInstruction.accounts.named.productAccount.pubkey.toBase58()
            ] = parsedInstruction.args.symbol;
          } else if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addPrice"
          ) {
            const productAccount = await provider.connection.getAccountInfo(
              parsedInstruction.accounts.named.productAccount.pubkey,
            );
            const productSymbol = productAccount
              ? parseProductData(productAccount.data).product.symbol
              : productAccountToSymbol[
                  parsedInstruction.accounts.named.productAccount.pubkey.toBase58()
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
              throw Error("Product account not found");
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
            .executePostedVaa()
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
              ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
            ])
            .rpc({ skipPreflight: false });
        } catch (e) {
          if (SKIP_FAILED_REMOTE_INSTRUCTIONS) {
            console.error(e);
          } else throw e;
        }
      }
    } else if (response.code == 5) {
      console.log(`All VAAs have been relayed`);
      console.log(
        `${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex",
        )}/${lastSequenceNumber}`,
      );
      break;
    } else {
      throw new Error("Could not connect to wormhole api");
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
