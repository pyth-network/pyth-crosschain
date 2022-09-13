import {
  importCoreWasm,
  ixFromRust,
  setDefaultWasm,
  utils as wormholeUtils,
} from "@certusone/wormhole-sdk";
import * as anchor from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import Squads from "@sqds/sdk";
import bs58 from "bs58";
import { program } from "commander";
import * as fs from "fs";

setDefaultWasm("node");

program
  .name("pyth-multisig")
  .description("CLI to creating and executing multisig transactions for pyth")
  .version("0.1.0");

program
  .command("create")
  .description("Create a new multisig transaction")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
  .requiredOption("-v, --vault-address <address>", "multisig vault address")
  .option(
    "-w, --wallet <filepath>",
    "multisig wallet secret key filepath",
    "keys/key.json"
  )
  .option("-p, --payload <string>", "payload to sign", "hello world")
  .action((options) => {
    createMultisigTx(
      options.cluster,
      new PublicKey(options.vaultAddress),
      options.wallet,
      options.payload
    );
  });

program
  .command("execute")
  .description("Execute a multisig transaction that is ready")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
  .requiredOption("-v, --vault-address <address>", "multisig vault address")
  .option(
    "-w, --wallet <filepath>",
    "multisig wallet secret key filepath",
    "keys/key.json"
  )
  .option(
    "-m, --message <filepath>",
    "multisig message account secret key filepath",
    "keys/message.json"
  )
  .requiredOption("-t, --tx-pda <address>", "transaction PDA")
  .requiredOption("-u, --rpc-url <url>", "wormhole RPC URL")
  .action((options) => {
    executeMultisigTx(
      options.cluster,
      new PublicKey(options.vaultAddress),
      options.wallet,
      options.message,
      new PublicKey(options.txPda),
      options.rpcUrl
    );
  });

program.parse();

// custom solana cluster type
type Cluster = "devnet" | "mainnet-beta";
type WormholeNetwork = "TESTNET" | "MAINNET";

// solana cluster mapping to wormhole cluster
const solanaClusterMappingToWormholeNetwork: Record<Cluster, WormholeNetwork> =
  {
    devnet: "TESTNET",
    "mainnet-beta": "MAINNET",
  };

async function getWormholeMessageIx(
  cluster: Cluster,
  payer: PublicKey,
  emitter: PublicKey,
  message: PublicKey,
  connection: anchor.web3.Connection,
  payload: string
) {
  const wormholeNetwork: WormholeNetwork =
    solanaClusterMappingToWormholeNetwork[cluster];
  const wormholeAddress = wormholeUtils.CONTRACTS[wormholeNetwork].solana.core;
  const { post_message_ix, fee_collector_address, state_address, parse_state } =
    await importCoreWasm();
  const feeCollector = new PublicKey(fee_collector_address(wormholeAddress));
  const bridgeState = new PublicKey(state_address(wormholeAddress));
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
        wormholeAddress,
        payer.toBase58(),
        emitter.toBase58(),
        message.toBase58(),
        0,
        new TextEncoder().encode(payload),
        "CONFIRMED"
      )
    ),
  ];
}

async function createMultisigTx(
  cluster: Cluster,
  vault: PublicKey,
  walletPath: string,
  payload: string
) {
  const wallet = new NodeWallet(
    Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "ascii")))
    )
  );

  const squads =
    cluster === "devnet" ? Squads.devnet(wallet) : Squads.mainnet(wallet);
  const msAccount = await squads.getMultisig(vault);

  const emitter = squads.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Emitter Address: ${emitter.toBase58()}`);

  const newTx = await squads.createTransaction(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Tx Address: ${newTx.publicKey.toBase58()}`);

  const message = Keypair.generate();
  // save message to Uint8 array keypair file called mesage.json
  fs.writeFileSync(`keys/message.json`, `[${message.secretKey.toString()}]`);
  console.log(`Message Address: ${message.publicKey.toBase58()}`);

  console.log("Creating wormhole instructions...");
  const wormholeIxs = await getWormholeMessageIx(
    cluster,
    emitter,
    emitter,
    message.publicKey,
    squads.connection,
    payload
  );
  console.log("Wormhole instructions created.");

  console.log("Creating transaction...");
  // transfer sol to the message account
  await squads.addInstruction(newTx.publicKey, wormholeIxs[0]);
  // wormhole post message ix
  await squads.addInstruction(newTx.publicKey, wormholeIxs[1]);

  await squads.activateTransaction(newTx.publicKey);
  console.log("Transaction created.");
}

async function executeMultisigTx(
  cluster: string,
  vault: PublicKey,
  walletPath: string,
  messagePath: string,
  txPDA: PublicKey,
  rpcUrl: string
) {
  const wallet = new NodeWallet(
    Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "ascii")))
    )
  );
  console.log(`Loaded wallet with address: ${wallet.publicKey.toBase58()}`);

  const message = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(messagePath, "ascii")))
  );
  console.log(
    `Loaded message account with address: ${message.publicKey.toBase58()}`
  );

  const squads =
    cluster === "devnet" ? Squads.devnet(wallet) : Squads.mainnet(wallet);
  const msAccount = await squads.getMultisig(vault);

  const emitter = squads.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );

  const executeIx = await squads.buildExecuteTransaction(
    txPDA,
    wallet.publicKey
  );
  executeIx.keys.forEach((key) => {
    if (key.pubkey.equals(message.publicKey)) {
      key.isSigner = true;
    }
  });

  // airdrop 0.1 SOL to emitter if on devnet
  if (cluster === "devnet") {
    const airdropSignature = await squads.connection.requestAirdrop(
      emitter,
      0.1 * LAMPORTS_PER_SOL
    );
    const { blockhash, lastValidBlockHeight } =
      await squads.connection.getLatestBlockhash();
    await squads.connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature: airdropSignature,
    });
    console.log("Airdropped 0.1 SOL to emitter");
  }

  const { blockhash, lastValidBlockHeight } =
    await squads.connection.getLatestBlockhash();
  // const executeTx = new anchor.web3.Transaction({
  //   blockhash,
  //   lastValidBlockHeight,
  //   feePayer: wallet.payer.publicKey,
  // });
  // const provider = new anchor.AnchorProvider(squads.connection, wallet, {
  //   ...anchor.AnchorProvider.defaultOptions(),
  //   commitment: "confirmed",
  //   preflightCommitment: "confirmed",
  // });
  // executeTx.add(executeIx);

  const tx = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: wallet.payer.publicKey,
  });
  tx.add(executeIx);
  await squads.wallet.signTransaction(tx);
  const signature = await sendAndConfirmTransaction(
    squads.connection,
    tx,
    [wallet.payer, message],
    { commitment: "confirmed" }
  );

  // const signature = await provider.sendAndConfirm(executeTx, [
  //   wallet.payer,
  //   message,
  // ]);
  console.log(
    `Executed tx: https://explorer.solana.com/tx/${signature}${
      cluster === "devnet" ? "?cluster=devnet" : ""
    }`
  );

  const txDetails = await squads.connection.getParsedTransaction(
    signature,
    "confirmed"
  );
  const txLog = txDetails?.meta?.logMessages?.find((s) =>
    s.includes("Sequence")
  );
  const substr = "Sequence: ";
  const sequenceNumber = Number(
    txLog?.substring(txLog.indexOf(substr) + substr.length)
  );
  console.log(`Sequence number: ${sequenceNumber}`);

  // sleep for 5 seconds
  console.log(
    "Sleeping for 5 seconds to allow guardians enough time to create VAA..."
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // fetch VAA
  console.log("Fetching VAA...");
  const response = await fetch(
    `${rpcUrl}/v1/signed_vaa/1/${Buffer.from(
      bs58.decode(emitter.toBase58())
    ).toString("hex")}/${sequenceNumber}`
  );
  const { vaaBytes } = await response.json();
  console.log(`VAA (Base64): ${vaaBytes}`);
  const parsedVaa = await parse(vaaBytes);
  console.log(`Emitter chain: ${parsedVaa.emitter_chain}`);
  console.log(`Nonce: ${parsedVaa.nonce}`);
  console.log(`Payload: ${Buffer.from(parsedVaa.payload).toString()}`);
}

async function parse(data: string) {
  const { parse_vaa } = await importCoreWasm();
  return parse_vaa(Uint8Array.from(Buffer.from(data, "base64")));
}
