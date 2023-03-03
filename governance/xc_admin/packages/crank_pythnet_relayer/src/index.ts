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
} from "xc_admin_common";

const CLUSTER: PythCluster = envOrErr("CLUSTER") as PythCluster;
const EMITTER: PublicKey = new PublicKey(envOrErr("EMITTER"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);
const OFFSET: number = Number(process.env.OFFSET ?? "-1");
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";

async function run() {
  const provider = new AnchorProvider(
    new Connection(getPythClusterApiUrl(CLUSTER), COMMITMENT),
    new NodeWallet(KEYPAIR),
    {
      commitment: COMMITMENT,
      preflightCommitment: COMMITMENT,
    }
  );
  const multisigParser = MultisigParser.fromCluster(CLUSTER);

  const remoteExecutor = await Program.at(REMOTE_EXECUTOR_ADDRESS, provider);

  const claimRecordAddress: PublicKey = PublicKey.findProgramAddressSync(
    [Buffer.from(CLAIM_RECORD_SEED), EMITTER.toBuffer()],
    remoteExecutor.programId
  )[0];
  const executorKey: PublicKey = mapKey(EMITTER);
  const claimRecord = await remoteExecutor.account.claimRecord.fetchNullable(
    claimRecordAddress
  );
  let lastSequenceNumber: number = claimRecord
    ? (claimRecord.sequence as BN).toNumber()
    : -1;
  lastSequenceNumber = Math.max(lastSequenceNumber, OFFSET);
  const wormholeApi = WORMHOLE_API_ENDPOINT[CLUSTER];
  const productAccountToSymbol: { [key: string]: string } = {};
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
            preInstructions.push(
              await getCreateAccountWithSeedInstruction(
                provider.connection,
                CLUSTER,
                provider.wallet.publicKey,
                parsedInstruction.args.symbol,
                AccountType.Product
              )
            );
            productAccountToSymbol[
              parsedInstruction.accounts.named.productAccount.pubkey.toBase58()
            ] = parsedInstruction.args.symbol;
          } else if (
            parsedInstruction instanceof PythMultisigInstruction &&
            parsedInstruction.name == "addPrice"
          ) {
            const productAccount = await provider.connection.getAccountInfo(
              parsedInstruction.accounts.named.productAccount.pubkey
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
                  AccountType.Price
                )
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
          .rpc({ skipPreflight: true });
      }
    } else if (response.code == 5) {
      throw new Error(
        `Wormhole API failure :${wormholeApi}/v1/signed_vaa/1/${EMITTER.toBuffer().toString(
          "hex"
        )}/${lastSequenceNumber}`
      );
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
