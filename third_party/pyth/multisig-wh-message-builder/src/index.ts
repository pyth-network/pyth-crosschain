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
  SystemProgram,
} from "@solana/web3.js";
import Squads from "@sqds/mesh";
import bs58 from "bs58";
import { program } from "commander";
import * as fs from "fs";
import { LedgerNodeWallet } from "./wallet";

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
  .option("-l, --ledger", "use ledger")
  .option(
    "-lda, --ledger-derivation-account <number>",
    "ledger derivation account to use"
  )
  .option(
    "-ldc, --ledger-derivation-change <number>",
    "ledger derivation change to use"
  )
  .option(
    "-w, --wallet <filepath>",
    "multisig wallet secret key filepath",
    "keys/key.json"
  )
  .option("-p, --payload <hex-string>", "payload to sign", "0xdeadbeef")
  .action((options) => {
    createMultisigTx(
      options.cluster,
      new PublicKey(options.vaultAddress),
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet,
      options.payload
    );
  });

program
  .command("execute")
  .description("Execute a multisig transaction that is ready")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
  .requiredOption("-v, --vault-address <address>", "multisig vault address")
  .option("-l, --ledger", "use ledger")
  .option(
    "-lda, --ledger-derivation-account <number>",
    "ledger derivation account to use"
  )
  .option(
    "-ldc, --ledger-derivation-change <number>",
    "ledger derivation change to use"
  )
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
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet,
      options.message,
      new PublicKey(options.txPda),
      options.rpcUrl
    );
  });

// TODO: add subcommand for creating governance messages in the right format

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

  if (payload.startsWith("0x")) {
    payload = payload.substring(2);
  }

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
        Uint8Array.from(Buffer.from(payload, 'hex')),
        "CONFIRMED"
      )
    ),
  ];
}

async function createMultisigTx(
  cluster: Cluster,
  vault: PublicKey,
  ledger: boolean,
  ledgerDerivationAccount: number | undefined,
  ledgerDerivationChange: number | undefined,
  walletPath: string,
  payload: string
) {
  let wallet: LedgerNodeWallet | NodeWallet;
  if (ledger) {
    console.log("Please connect to ledger...");
    wallet = await LedgerNodeWallet.createWallet(
      ledgerDerivationAccount,
      ledgerDerivationChange
    );
    console.log(`Ledger connected! ${wallet.publicKey.toBase58()}`);
  } else {
    wallet = new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "ascii")))
      )
    );
    console.log(`Loaded wallet with address: ${wallet.publicKey.toBase58()}`);
  }
  const squad =
    cluster === "devnet" ? Squads.devnet(wallet) : Squads.mainnet(wallet);
  const msAccount = await squad.getMultisig(vault);

  const emitter = squad.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Emitter Address: ${emitter.toBase58()}`);

  console.log("Creating new transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  const newTx = await squad.createTransaction(
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
    squad.connection,
    payload
  );
  console.log("Wormhole instructions created.");

  console.log("Adding instruction 1/2 to transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  // transfer sol to the message account
  await squad.addInstruction(newTx.publicKey, wormholeIxs[0]);
  console.log("Adding instruction 2/2 to transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  // wormhole post message ix
  await squad.addInstruction(newTx.publicKey, wormholeIxs[1]);

  console.log("Activating transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  await squad.activateTransaction(newTx.publicKey);
  console.log("Transaction created.");
}

async function executeMultisigTx(
  cluster: string,
  vault: PublicKey,
  ledger: boolean,
  ledgerDerivationAccount: number | undefined,
  ledgerDerivationChange: number | undefined,
  walletPath: string,
  messagePath: string,
  txPDA: PublicKey,
  rpcUrl: string
) {
  let wallet: LedgerNodeWallet | NodeWallet;
  if (ledger) {
    console.log("Please connect to ledger...");
    wallet = await LedgerNodeWallet.createWallet(
      ledgerDerivationAccount,
      ledgerDerivationChange
    );
    console.log(`Ledger connected! ${wallet.publicKey.toBase58()}`);
  } else {
    wallet = new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "ascii")))
      )
    );
    console.log(`Loaded wallet with address: ${wallet.publicKey.toBase58()}`);
  }

  const message = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(messagePath, "ascii")))
  );
  console.log(
    `Loaded message account with address: ${message.publicKey.toBase58()}`
  );

  const squad =
    cluster === "devnet" ? Squads.devnet(wallet) : Squads.mainnet(wallet);
  const msAccount = await squad.getMultisig(vault);

  const emitter = squad.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );

  const executeIx = await squad.buildExecuteTransaction(
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
    console.log("Airdropping 0.1 SOL to emitter...");
    const airdropSignature = await squad.connection.requestAirdrop(
      emitter,
      0.1 * LAMPORTS_PER_SOL
    );
    const { blockhash, lastValidBlockHeight } =
      await squad.connection.getLatestBlockhash();
    await squad.connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature: airdropSignature,
    });
    console.log("Airdropped 0.1 SOL to emitter");
  }

  const { blockhash, lastValidBlockHeight } =
    await squad.connection.getLatestBlockhash();
  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: wallet.publicKey,
  });
  const provider = new anchor.AnchorProvider(squad.connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  executeTx.add(executeIx);

  console.log("Sending transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  const signature = await provider.sendAndConfirm(executeTx, [message]);

  console.log(
    `Executed tx: https://explorer.solana.com/tx/${signature}${
      cluster === "devnet" ? "?cluster=devnet" : ""
    }`
  );

  const txDetails = await squad.connection.getParsedTransaction(
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
  console.log(`Payload: ${Buffer.from(parsedVaa.payload).toString('hex')}`);
}

async function parse(data: string) {
  const { parse_vaa } = await importCoreWasm();
  return parse_vaa(Uint8Array.from(Buffer.from(data, "base64")));
}
