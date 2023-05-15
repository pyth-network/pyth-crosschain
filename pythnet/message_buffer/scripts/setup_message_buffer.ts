import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { MessageBuffer } from "../target/types/message_buffer";
import messageBuffer from "../target/idl/message_buffer.json";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { assert } from "chai";

//TODO: read this from host
const payer = anchor.web3.Keypair.fromSecretKey(
  // Keypair at keys/funding.json
  Uint8Array.from([
    235, 245, 49, 124, 125, 91, 162, 107, 245, 83, 158, 7, 86, 181, 31, 252,
    215, 200, 125, 25, 126, 55, 37, 240, 205, 171, 71, 196, 2, 11, 137, 229,
    131, 30, 46, 220, 89, 75, 108, 173, 185, 146, 114, 253, 109, 67, 214, 133,
    117, 79, 154, 107, 133, 193, 249, 251, 40, 171, 42, 191, 192, 60, 188, 78,
  ])
);

const commitment = "finalized";
const provider = new anchor.AnchorProvider(
  new anchor.web3.Connection("http://pythnet:8899"),
  new NodeWallet(payer),
  {
    commitment,
    preflightCommitment: commitment,
    skipPreflight: true,
  }
);

anchor.setProvider(provider);
const messageBufferPid = new anchor.web3.PublicKey(
  "BZZFM8qzdWvv4ysy8dxpAzjs9WJ6iy9y1ph2YNqWYzrm"
);

const messageBufferProgram = new Program(
  messageBuffer as Idl,
  messageBufferPid,
  provider
) as unknown as Program<MessageBuffer>;

const whitelistAdmin = payer;

const MESSAGE = Buffer.from("message");
const [whitelistPubkey, whitelistBump] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [MESSAGE, Buffer.from("whitelist")],
    messageBufferProgram.programId
  );

const pythOraclePid = new anchor.web3.PublicKey(
  "7th6GdMuo4u1zNLzFAyMY6psunHNsGjPjo8hXvcTgKei"
);

const [pythOracleCpiAuth] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("upd_price_write"), messageBufferProgram.programId.toBuffer()],
  pythOraclePid
);

const pythPriceAccountPk = new anchor.web3.PublicKey(
  "tvNV74CEkyEhmzJYiXGgcTMLCSX8JDPVi3er5ZSTJn2"
);

const [messageBufferPda, messageBufferBump] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [pythOracleCpiAuth.toBuffer(), MESSAGE, pythPriceAccountPk.toBuffer()],
    messageBufferProgram.programId
  );

async function main() {
  console.log("Initializing message buffer...");

  console.group();
  console.log("Requesting airdrop");

  let airdropSig = await provider.connection.requestAirdrop(
    payer.publicKey,
    1 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction({
    signature: airdropSig,
    ...(await provider.connection.getLatestBlockhash()),
  });

  const whitelistAdminBalance = await provider.connection.getBalance(
    whitelistAdmin.publicKey
  );
  console.log(`whitelistAdminBalance: ${whitelistAdminBalance}`);
  console.log("Airdrop complete");
  console.groupEnd();

  console.group("Initialize message buffer");
  const initializeTxn = await messageBufferProgram.methods
    .initialize(whitelistAdmin.publicKey)
    .accounts({})
    .rpc();

  console.log("fetching & checking whitelist");
  let whitelist = await messageBufferProgram.account.whitelist.fetch(
    whitelistPubkey
  );

  assert.strictEqual(whitelist.bump, whitelistBump);
  assert.isTrue(whitelist.admin.equals(whitelistAdmin.publicKey));
  console.groupEnd();
  console.group("Set Allowed Programs");
  const allowedProgramAuthorities = [pythOracleCpiAuth];
  await messageBufferProgram.methods
    .setAllowedPrograms(allowedProgramAuthorities)
    .accounts({
      admin: whitelistAdmin.publicKey,
    })
    .signers([whitelistAdmin])
    .rpc();
  console.log("fetching & checking whitelist after add");
  whitelist = await messageBufferProgram.account.whitelist.fetch(
    whitelistPubkey
  );
  console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);
  const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
    pk.toString()
  );
  assert.deepEqual(
    whitelistAllowedPrograms,
    allowedProgramAuthorities.map((p) => p.toString())
  );
  console.groupEnd();

  console.group("Create Message Buffer");
  const msgBufferPdaMetas = [
    {
      pubkey: messageBufferPda,
      isSigner: false,
      isWritable: true,
    },
  ];

  await messageBufferProgram.methods
    .createBuffer(pythOracleCpiAuth, pythPriceAccountPk, 1024 * 8)
    .accounts({
      whitelist: whitelistPubkey,
      admin: whitelistAdmin.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([whitelistAdmin])
    .remainingAccounts(msgBufferPdaMetas)
    .rpc({ skipPreflight: true });

  console.log("fetching messageBuffer");
  const messageBufferData = await getMessageBuffer(
    provider.connection,
    messageBufferPda
  );
  console.log(`messageBufferData: ${messageBufferData.toString("utf-8")}`);
  console.groupEnd();
}

async function getMessageBuffer(
  connection: anchor.web3.Connection,
  accountKey: anchor.web3.PublicKey
): Promise<Buffer | null> {
  let accountInfo = await connection.getAccountInfo(accountKey);
  return accountInfo ? accountInfo.data : null;
}

void main();
