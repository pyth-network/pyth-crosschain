import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey } from "@solana/web3.js";
import Squads from "@sqds/sdk";
import { importCoreWasm, ixFromRust, setDefaultWasm, utils as wormholeUtils } from "@certusone/wormhole-sdk";
import * as fs from "fs";

setDefaultWasm("node");

async function getWormholeMessageIx(payer: PublicKey, emitter: PublicKey, message: PublicKey) {
  const wormholeDevnet = wormholeUtils.CONTRACTS["DEVNET"].solana.core;
  const { post_message_ix } = await importCoreWasm();
  
  return ixFromRust(post_message_ix(
    wormholeDevnet,
    payer.toBase58(),
    emitter.toBase58(),
    message.toBase58(),
    0,
    (new TextEncoder()).encode("HI"),
    "CONFIRMED"
  ));
}

async function run() {
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync("key.json", 'ascii')));
  const wallet = new NodeWallet(Keypair.fromSecretKey(secretKey));

  console.log(`Loaded wallet with address: wallet.publicKey.toBase58()`);

  const squads = Squads.devnet(wallet);

  const testMultiSigPubKey = new PublicKey("GsBApfBbQjLYTEhopXZPrVi2GvSScen9JJyEBwZpEeJa");
  const msAccount = await squads.getMultisig(testMultiSigPubKey);

  const emitter = squads.getAuthorityPDA(msAccount.publicKey, msAccount.authorityIndex);
  console.log(emitter.toBase58());

  const newTx = await squads.createTransaction(msAccount.publicKey, msAccount.authorityIndex);
  console.log("###############\n" + "###############\n");
  console.log(newTx);

  const message = Keypair.generate();
  console.log("###############\n" + "Message Account" + "###############\n");
  console.log(message);

  const wormholeIx = await getWormholeMessageIx(wallet.publicKey, emitter, message.publicKey);
  console.log("###############\n" + "###############\n");
  console.log(wormholeIx);
  


  const newIx = await squads.addInstruction(newTx.publicKey, wormholeIx);
  console.log("###############\n" + "###############\n");
  console.log(newIx);

  const activatedTx = await squads.activateTransaction(newTx.publicKey);
  console.log("###############\n" + "###############\n");
  console.log(activatedTx);
}

async function execute() {
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync("key.json", 'ascii')));
  const wallet = new NodeWallet(Keypair.fromSecretKey(secretKey));

  console.log(`Loaded wallet with address: wallet.publicKey.toBase58()`);

  const squads = Squads.devnet(wallet);

  const msgSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync("msg-key.json", 'ascii')));
  const messageKeypair = Keypair.fromSecretKey(msgSecretKey);

  const testTxPubKey = new PublicKey("3UB1qaxY3P91efpuf3bCikkxJdTiuKAEn2kciEFEMTpH");
  await squads.executeTransaction(testTxPubKey, wallet.publicKey, [messageKeypair]);
}

// run();
execute();
