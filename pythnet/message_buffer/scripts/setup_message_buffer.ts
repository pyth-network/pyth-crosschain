import fs from "node:fs";
import path from "node:path";
import type { Idl } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import type { PythCluster } from "@pythnetwork/client";
import {
  AccountType,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  parseBaseData,
  parseProductData,
} from "@pythnetwork/client";
import type { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import dotenv from "dotenv";
import messageBuffer from "../target/idl/message_buffer.json";
import type { MessageBuffer } from "../target/types/message_buffer";

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
  const priceAccountIds: PublicKey[] = [];
  accountList.forEach((singleAccount) => {
    const base = parseBaseData(singleAccount.account.data);
    if (base) {
      switch (base.type) {
        case AccountType.Product: {
          const productData = parseProductData(singleAccount.account.data);
          priceAccountIds.push(productData.priceAccountKey);
          break;
        }
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
  const initialSize = Number.parseInt(process.env.INITIAL_SIZE || "", 10);
  const whitelistAdmin = payer;
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
    const airdropSig = await provider.connection.requestAirdrop(
      payer.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction({
      signature: airdropSig,
      ...(await provider.connection.getLatestBlockhash()),
    });

    const _payerBalance = await provider.connection.getBalance(payer.publicKey);
  } else {
  }

  let whitelist =
    await messageBufferProgram.account.whitelist.fetchNullable(whitelistPubkey);

  if (whitelist === null) {
    const _initializeTxnSig = await messageBufferProgram.methods
      .initialize()
      .accounts({
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
      })
      .signers([whitelistAdmin, payer])
      .rpc();
    whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);

    assert.strictEqual(whitelist.bump, whitelistBump);
    assert.isTrue(whitelist.admin.equals(whitelistAdmin.publicKey));
  } else {
  }

  if (whitelist.allowedPrograms.length === 0) {
    const allowedProgramAuthorities = [pythOracleCpiAuth];
    const _setAllowedProgramSig = await messageBufferProgram.methods
      .setAllowedPrograms(allowedProgramAuthorities)
      .accounts({
        admin: whitelistAdmin.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();
    whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
      pk.toString(),
    );
    assert.deepEqual(
      whitelistAllowedPrograms,
      allowedProgramAuthorities.map((p) => p.toString()),
    );
  } else {
  }

  const priceIds = await getPriceAccountPubkeys(connection, pythOraclePid);
  const errorAccounts = [];
  let _alreadyInitializedAccounts = [];
  const newlyInitializedAccounts = [];

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

  const accounts =
    await messageBufferProgram.account.messageBuffer.fetchMultiple(
      messageBufferKeys.map((k) => k.messageBuffer),
    );

  const msgBufferKeysAndData = messageBufferKeys.map((k, i) => {
    return {
      ...k,
      messageBufferData: accounts[i],
    };
  });

  _alreadyInitializedAccounts = msgBufferKeysAndData
    .filter((idAndAccount) => {
      return idAndAccount.messageBufferData !== null;
    })
    .map((v) => {
      return {
        messageBuffer: v.messageBuffer.toString(),
        priceAccount: v.priceAccount.toString(),
      };
    });

  const priceAccountPubkeysForNewlyInitializedMessageBuffers =
    msgBufferKeysAndData.filter((idAndAccount) => {
      return idAndAccount.messageBufferData === null;
    });

  if (priceAccountPubkeysForNewlyInitializedMessageBuffers.length === 0) {
  }
  // TODO: optimize with batching
  await Promise.all(
    priceAccountPubkeysForNewlyInitializedMessageBuffers.map(
      async (idAndAccount) => {
        const priceId = idAndAccount.priceAccount;
        const messageBufferPda = idAndAccount.messageBuffer;
        const msgBufferPdaMetas = [
          {
            isSigner: false,
            isWritable: true,
            pubkey: messageBufferPda,
          },
        ];

        try {
          await messageBufferProgram.methods
            .createBuffer(pythOracleCpiAuth, priceId, initialSize)
            .accounts({
              admin: whitelistAdmin.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
              whitelist: whitelistPubkey,
            })
            .signers([whitelistAdmin])
            .remainingAccounts(msgBufferPdaMetas)
            .rpc({ skipPreflight: true });
          newlyInitializedAccounts.push({
            messageBuffer: messageBufferPda.toString(),
            priceId: priceId.toString(),
          });
        } catch (_e) {
          errorAccounts.push({
            messageBuffer: messageBufferPda.toString(),
            priceId: priceId.toString(),
          });
        }
      },
    ),
  );
  if (errorAccounts.length > 0) {
  }

  // Update whitelist admin at the end otherwise all the message buffer PDAs
  // will have to be initialized by the whitelist admin (which could be the multisig)
  if (process.env.WHITELIST_ADMIN) {
    whitelist =
      await messageBufferProgram.account.whitelist.fetchNullable(
        whitelistPubkey,
      );
    const newWhitelistAdmin = new anchor.web3.PublicKey(
      process.env.WHITELIST_ADMIN,
    );
    if (!whitelist.admin.equals(newWhitelistAdmin)) {
      try {
        await messageBufferProgram.methods
          .updateWhitelistAdmin(newWhitelistAdmin)
          .accounts({
            admin: whitelistAdmin.publicKey,
          })
          .signers([whitelistAdmin])
          .rpc();
      } catch (_e) {}
    } else {
    }
  }
}

void main();
