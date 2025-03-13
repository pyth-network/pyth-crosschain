import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { MessageBuffer } from "../target/types/message_buffer";
import messageBuffer from "../target/idl/message_buffer.json";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { assert } from "chai";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PythCluster,
  parseBaseData,
  AccountType,
  parseProductData,
} from "@pythnetwork/client";

import path from "path";
import dotenv from "dotenv";
import fs from "fs";

type PythClusterOrIntegration = PythCluster | "integration";
/**
 * Script to initialize the message buffer program and whitelist admin
 * using the integration repo setup
 *
 * run using the following command:
 * `NODE_ENV=<env> yarn ts-node scripts/setup_message_buffer.ts`
 */
const MESSAGE = Buffer.from("message");

function getPythClusterEndpoint(cluster: PythClusterOrIntegration): string {
  if (cluster === "integration") {
    return "http://pythnet:8899";
  }
  return getPythClusterApiUrl(cluster);
}

function getPythPidForCluster(
  cluster: PythClusterOrIntegration,
): anchor.web3.PublicKey {
  if (cluster === "integration") {
    return new anchor.web3.PublicKey(
      "7th6GdMuo4u1zNLzFAyMY6psunHNsGjPjo8hXvcTgKei",
    );
  } else {
    return getPythProgramKeyForCluster(cluster);
  }
}

const getKeypairFromFile = (keypairPath: string): anchor.web3.Keypair => {
  const keypairBuffer = fs.readFileSync(keypairPath);
  return anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(keypairBuffer.toString())),
  );
};

function getPythOracleCpiAuth(
  messageBufferProgramId: anchor.web3.PublicKey,
  pythOracleProgramId: anchor.web3.PublicKey,
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("upd_price_write"), messageBufferProgramId.toBuffer()],
    pythOracleProgramId,
  )[0];
}

function getMessageBufferPubkey(
  pythOracleCpiAuth: anchor.web3.PublicKey,
  pythPriceAccountPk: anchor.web3.PublicKey,
  messageBufferProgramId: anchor.web3.PublicKey,
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [pythOracleCpiAuth.toBuffer(), MESSAGE, pythPriceAccountPk.toBuffer()],
    messageBufferProgramId,
  )[0];
}

export async function getPriceAccountPubkeys(
  connection: anchor.web3.Connection,
  pythPublicKey: anchor.web3.PublicKey,
): Promise<PublicKey[]> {
  const accountList = await connection.getProgramAccounts(
    pythPublicKey,
    connection.commitment,
  );
  console.info(
    `fetched ${
      accountList.length
    } programAccounts for pythProgram: ${pythPublicKey.toString()}`,
  );
  const priceAccountIds: PublicKey[] = [];
  accountList.forEach((singleAccount) => {
    const base = parseBaseData(singleAccount.account.data);
    if (base) {
      switch (base.type) {
        case AccountType.Product:
          const productData = parseProductData(singleAccount.account.data);
          priceAccountIds.push(productData.priceAccountKey);
          break;
        default:
          break;
      }
    }
  });
  return priceAccountIds;
}

async function main() {
  let canAirdrop = false;
  switch (process.env.NODE_ENV) {
    case "local":
      dotenv.config({ path: path.join(__dirname, ".env.local") });
      canAirdrop = true;
      break;
    case "integration":
      dotenv.config({ path: path.join(__dirname, ".env.integration") });
      canAirdrop = true;
      break;
    case "pythtest":
      dotenv.config({ path: path.join(__dirname, ".env.pythtest") });
      break;
    case "pythnet":
      dotenv.config({ path: path.join(__dirname, ".env.pythnet") });
      break;
    default:
      console.error(`Invalid NODE_ENV: ${process.env.NODE_ENV}`);
      process.exit(1);
  }

  const cluster = process.env.CLUSTER as PythClusterOrIntegration;

  const messageBufferPid = new anchor.web3.PublicKey(
    process.env.MESSAGE_BUFFER_PROGRAM_ID,
  );
  const pythOraclePid = getPythPidForCluster(cluster);
  const payer = getKeypairFromFile(
    path.resolve(process.env.PAYER_KEYPAIR_PATH),
  );
  const endpoint = getPythClusterEndpoint(cluster);
  const initialSize = parseInt(process.env.INITIAL_SIZE || "", 10);
  let whitelistAdmin = payer;

  console.info(`
        messageBufferPid: ${messageBufferPid.toString()}
        pythOraclePid: ${pythOraclePid.toString()}
        payer: ${payer.publicKey.toString()}
        endpoint: ${endpoint}
        whitelistAdmin: ${whitelistAdmin.publicKey.toString()}
        initialSize: ${initialSize}
    `);

  console.log(`connecting to ${endpoint}`);
  const connection = new anchor.web3.Connection(endpoint);
  const commitment = "finalized";

  const provider = new anchor.AnchorProvider(
    connection,
    new NodeWallet(payer),
    {
      commitment,
      preflightCommitment: commitment,
      skipPreflight: true,
    },
  );

  anchor.setProvider(provider);

  const messageBufferProgram = new Program(
    messageBuffer as Idl,
    messageBufferPid,
    provider,
  ) as unknown as Program<MessageBuffer>;

  const [whitelistPubkey, whitelistBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [MESSAGE, Buffer.from("whitelist")],
      messageBufferProgram.programId,
    );

  const pythOracleCpiAuth = getPythOracleCpiAuth(
    messageBufferProgram.programId,
    pythOraclePid,
  );

  if (canAirdrop) {
    console.group("Requesting airdrop");

    let airdropSig = await provider.connection.requestAirdrop(
      payer.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction({
      signature: airdropSig,
      ...(await provider.connection.getLatestBlockhash()),
    });

    const payerBalance = await provider.connection.getBalance(payer.publicKey);
    console.log(`payerBalance: ${payerBalance}`);
    console.log("Airdrop complete");
    console.groupEnd();
  } else {
    console.log("Skipping airdrop for non-local/integration environments");
  }

  console.log("Initializing message buffer whitelist admin...");

  let whitelist =
    await messageBufferProgram.account.whitelist.fetchNullable(whitelistPubkey);

  if (whitelist === null) {
    console.group(
      "No whitelist detected. Initializing message buffer whitelist & admin",
    );
    const initializeTxnSig = await messageBufferProgram.methods
      .initialize()
      .accounts({
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
      })
      .signers([whitelistAdmin, payer])
      .rpc();

    console.log(`initializeTxnSig: ${initializeTxnSig}`);

    console.log("fetching & checking whitelist");
    whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);

    assert.strictEqual(whitelist.bump, whitelistBump);
    assert.isTrue(whitelist.admin.equals(whitelistAdmin.publicKey));
    console.groupEnd();
  } else {
    console.log("Whitelist already initialized");
  }

  if (whitelist.allowedPrograms.length === 0) {
    console.group("Setting Allowed Programs");
    const allowedProgramAuthorities = [pythOracleCpiAuth];
    let setAllowedProgramSig = await messageBufferProgram.methods
      .setAllowedPrograms(allowedProgramAuthorities)
      .accounts({
        admin: whitelistAdmin.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();
    console.log(`setAllowedProgramSig: ${setAllowedProgramSig}`);
    console.log("fetching & checking whitelist after add");
    whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);
    const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
      pk.toString(),
    );
    assert.deepEqual(
      whitelistAllowedPrograms,
      allowedProgramAuthorities.map((p) => p.toString()),
    );
    console.groupEnd();
  } else {
    console.log("Allowed Programs already set");
  }

  let priceIds = await getPriceAccountPubkeys(connection, pythOraclePid);
  console.info(`fetched ${priceIds.length} priceAccountIds`);
  let errorAccounts = [];
  let alreadyInitializedAccounts = [];
  let newlyInitializedAccounts = [];

  const messageBufferKeys = priceIds.map((priceId) => {
    return {
      messageBuffer: getMessageBufferPubkey(
        pythOracleCpiAuth,
        priceId,
        messageBufferPid,
      ),
      priceAccount: priceId,
    };
  });

  let accounts = await messageBufferProgram.account.messageBuffer.fetchMultiple(
    messageBufferKeys.map((k) => k.messageBuffer),
  );

  const msgBufferKeysAndData = messageBufferKeys.map((k, i) => {
    return {
      ...k,
      messageBufferData: accounts[i],
    };
  });

  alreadyInitializedAccounts = msgBufferKeysAndData
    .filter((idAndAccount) => {
      return idAndAccount.messageBufferData !== null;
    })
    .map((v) => {
      return {
        priceAccount: v.priceAccount.toString(),
        messageBuffer: v.messageBuffer.toString(),
      };
    });

  console.log(`
  ${alreadyInitializedAccounts.length} message buffer accounts already initialized`);
  console.table(alreadyInitializedAccounts);

  const priceAccountPubkeysForNewlyInitializedMessageBuffers =
    msgBufferKeysAndData.filter((idAndAccount) => {
      return idAndAccount.messageBufferData === null;
    });

  if (priceAccountPubkeysForNewlyInitializedMessageBuffers.length === 0) {
    console.info(`no new message buffers to initialize`);
  }
  // TODO: optimize with batching
  await Promise.all(
    priceAccountPubkeysForNewlyInitializedMessageBuffers.map(
      async (idAndAccount) => {
        const priceId = idAndAccount.priceAccount;
        const messageBufferPda = idAndAccount.messageBuffer;
        const msgBufferPdaMetas = [
          {
            pubkey: messageBufferPda,
            isSigner: false,
            isWritable: true,
          },
        ];

        try {
          await messageBufferProgram.methods
            .createBuffer(pythOracleCpiAuth, priceId, initialSize)
            .accounts({
              whitelist: whitelistPubkey,
              admin: whitelistAdmin.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([whitelistAdmin])
            .remainingAccounts(msgBufferPdaMetas)
            .rpc({ skipPreflight: true });
          newlyInitializedAccounts.push({
            priceId: priceId.toString(),
            messageBuffer: messageBufferPda.toString(),
          });
        } catch (e) {
          console.error(
            "Error creating message buffer for price account: ",
            priceId.toString(),
          );
          console.error(e);
          errorAccounts.push({
            priceId: priceId.toString(),
            messageBuffer: messageBufferPda.toString(),
          });
        }
      },
    ),
  );
  if (errorAccounts.length !== 0) {
    console.error(
      `Ran into errors when initializing ${errorAccounts.length} accounts`,
    );
    console.info(`Accounts with errors: ${JSON.stringify(errorAccounts)}`);
  }
  console.log(`Initialized ${newlyInitializedAccounts.length} accounts`);
  console.table(newlyInitializedAccounts);

  // Update whitelist admin at the end otherwise all the message buffer PDAs
  // will have to be initialized by the whitelist admin (which could be the multisig)
  if (process.env.WHITELIST_ADMIN) {
    whitelist =
      await messageBufferProgram.account.whitelist.fetchNullable(
        whitelistPubkey,
      );
    let newWhitelistAdmin = new anchor.web3.PublicKey(
      process.env.WHITELIST_ADMIN,
    );
    if (!whitelist.admin.equals(newWhitelistAdmin)) {
      console.info(
        `updating whitelist admin from ${whitelist.admin.toString()} to ${newWhitelistAdmin.toString()}`,
      );
      try {
        await messageBufferProgram.methods
          .updateWhitelistAdmin(newWhitelistAdmin)
          .accounts({
            admin: whitelistAdmin.publicKey,
          })
          .signers([whitelistAdmin])
          .rpc();
      } catch (e) {
        console.error(`Error when attempting to update the admin: ${e}`);
      }
    } else {
      console.info(
        `whitelist admin is already ${newWhitelistAdmin.toString()}`,
      );
    }
  }
}

void main();
