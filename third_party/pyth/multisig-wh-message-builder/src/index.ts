import {
  importCoreWasm,
  ixFromRust,
  setDefaultWasm,
  utils as wormholeUtils,
} from "@certusone/wormhole-sdk";
import * as anchor from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import Squads from "@sqds/sdk";
import * as fs from "fs";

setDefaultWasm("node");

async function getWormholeMessageIx(
  payer: PublicKey,
  emitter: PublicKey,
  message: PublicKey,
  connection: anchor.web3.Connection
) {
  const wormholeDevnet = wormholeUtils.CONTRACTS["TESTNET"].solana.core;
  const { post_message_ix, fee_collector_address, state_address, parse_state } =
    await importCoreWasm();
  const feeCollector = new PublicKey(fee_collector_address(wormholeDevnet));
  const bridgeState = new PublicKey(state_address(wormholeDevnet));
  const bridgeAccountInfo = await connection.getAccountInfo(bridgeState);
  const bridgeStateParsed = parse_state(bridgeAccountInfo!.data);
  const bridgeFee = bridgeStateParsed.config.fee;

  return [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: feeCollector,
      lamports: bridgeFee,
    }),
    ixFromRust(
      post_message_ix(
        wormholeDevnet,
        payer.toBase58(),
        emitter.toBase58(),
        message.toBase58(),
        0,
        new TextEncoder().encode("HI"),
        "CONFIRMED"
      )
    ),
  ];
}

async function run() {
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync("key.json", "ascii"))
  );
  const wallet = new NodeWallet(Keypair.fromSecretKey(secretKey));

  console.log(`Loaded wallet with address: ${wallet.publicKey.toBase58()}`);

  const squads = Squads.devnet(wallet);

  // create ms account
  // const multisigAccount = await squads.createMultisig(1, wallet.publicKey, [wallet.publicKey]);

  const testMultiSigPubKey = new PublicKey(
    "68BXkk4cgkUBbjc33LKjKLeiogNHuCsx1SrkANfon1Y2"
  );
  const msAccount = await squads.getMultisig(testMultiSigPubKey);

  const emitter = squads.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Emitter: ${emitter.toBase58()}`);

  const newTx = await squads.createTransaction(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log("\n###############\n" + "New Tx" + "\n###############");
  // console.log(newTx);
  console.log(`NewTx Account: ${newTx.publicKey.toBase58()}`);

  const message = Keypair.generate();
  console.log("\n###############\n" + "Message Account" + "\n###############");
  // console.log(message);
  console.log(`Message Account: ${message.publicKey.toBase58()}`);

  const wormholeIxs = await getWormholeMessageIx(
    wallet.publicKey,
    emitter,
    message.publicKey,
    squads.connection
  );
  console.log("\n###############\n" + "Wormhole Ix" + "\n###############");
  // console.log(wormholeIx);

  const newIx = await squads.addInstruction(newTx.publicKey, wormholeIxs[0]);
  console.log("\n###############\n" + "New Ix" + "\n###############");
  // console.log(newIx);
  const newerIx = await squads.addInstruction(newTx.publicKey, wormholeIxs[1]);
  

  const activatedTx = await squads.activateTransaction(newTx.publicKey);
  console.log("\n###############\n" + "Activated Tx" + "\n###############");
  // console.log(activatedTx);
  console.log(`ActivatedTx Account: ${activatedTx.publicKey.toBase58()}`);

  await squads.approveTransaction(activatedTx.publicKey);

  const executeIx = await squads.buildExecuteTransaction(
    activatedTx.publicKey,
    wallet.publicKey
  );
  executeIx.keys.forEach((key) => {
    if (key.pubkey.equals(message.publicKey)) {
      key.isSigner = true;
    }
  });

  const { blockhash } = await squads.connection.getLatestBlockhash();
  const lastValidBlockHeight = await squads.connection.getBlockHeight();
  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: wallet.payer.publicKey,
  });
  const provider = new anchor.AnchorProvider(squads.connection, wallet, {
    ...anchor.AnchorProvider.defaultOptions(),
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  executeTx.add(executeIx);
  await provider.sendAndConfirm(executeTx, [wallet.payer, message]);
}

async function parse(data: string) {
  const { parse_vaa } = await importCoreWasm();

  console.log(parse_vaa(Uint8Array.from(Buffer.from(data, "base64"))));
}

run();
