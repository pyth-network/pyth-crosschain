import {
  importCoreWasm,
  ixFromRust,
  setDefaultWasm,
  utils as wormholeUtils,
} from "@certusone/wormhole-sdk";
import * as anchor from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  AccountMeta,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
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
  .action(async (options) => {
    const squad = await getSquadsClient(
      options.cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    await createWormholeMsgMultisigTx(
      options.cluster,
      squad,
      options.ledger,
      new PublicKey(options.vaultAddress),
      options.payload
    );
  });

program
  .command("set-is-active")
  .description(
    "Create a new multisig transaction to set the attester is-active flag"
  )
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
  .option("-a, --attester <program id>")
  .option(
    "-i, --is-active <true/false>",
    "set the isActive field to this value",
    "true"
  )
  .action(async (options) => {
    const squad = await getSquadsClient(
      options.cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    const msAccount = await squad.getMultisig(new PublicKey(options.vaultAddress));

    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );
    const attesterProgramId = new PublicKey(options.attester);
    const txKey = await createTx(
      squad,
      options.ledger,
      new PublicKey(options.vaultAddress)
    );

    let isActive = undefined;
    if (options.isActive === 'true') {
      isActive = true;
    } else if (options.isActive === 'false') {
      isActive = false;
    } else {
      throw new Error(`Illegal argument for --is-active. Expected "true" or "false", got "${options.isActive}"`)
    }

    const squadIxs: SquadInstruction[] = [
      {
        instruction: await setIsActiveIx(
          vaultAuthority,
          vaultAuthority,
          attesterProgramId,
          isActive
        ),
      },
    ];
    await addInstructionsToTx(
      options.cluster,
      squad,
      options.ledger,
      msAccount.publicKey,
      txKey,
      squadIxs
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
      new PublicKey(options.txPda),
      options.rpcUrl
    );
  });

// TODO: add subcommand for creating governance messages in the right format

program.parse();

// custom solana cluster type
type Cluster = "devnet" | "mainnet";
type WormholeNetwork = "TESTNET" | "MAINNET";

// solana cluster mapping to wormhole cluster
const solanaClusterMappingToWormholeNetwork: Record<Cluster, WormholeNetwork> =
  {
    devnet: "TESTNET",
    mainnet: "MAINNET",
  };

async function getSquadsClient(
  cluster: Cluster,
  ledger: boolean,
  ledgerDerivationAccount: number | undefined,
  ledgerDerivationChange: number | undefined,
  walletPath: string
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
  return squad;
}

async function createTx(
  squad: Squads,
  ledger: boolean,
  vault: PublicKey
): Promise<PublicKey> {
  const msAccount = await squad.getMultisig(vault);

  console.log("Creating new transaction...");
  if (ledger) {
    console.log("Please approve the transaction on your ledger device...");
  }
  const newTx = await squad.createTransaction(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Tx Address: ${newTx.publicKey.toBase58()}`);

  return newTx.publicKey;
}

type SquadInstruction = {
  instruction: anchor.web3.TransactionInstruction;
  authorityIndex?: number;
  authorityBump?: number;
  authorityType?: string;
};

/** Adds the given instructions to the squads transaction at `txKey` and activates the transaction (makes it ready for signing). */
async function addInstructionsToTx(
  cluster: Cluster,
  squad: Squads,
  ledger: boolean,
  vault: PublicKey,
  txKey: PublicKey,
  instructions: SquadInstruction[]
) {
  for (let i = 0; i < instructions.length; i++) {
    console.log(
      `Adding instruction ${i + 1}/${instructions.length} to transaction...`
    );
    if (ledger) {
      console.log("Please approve the transaction on your ledger device...");
    }
    await squad.addInstruction(
      txKey,
      instructions[i].instruction,
      instructions[i].authorityIndex,
      instructions[i].authorityBump,
      instructions[i].authorityType
    );
  }

  console.log("Activating transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  await squad.activateTransaction(txKey);
  console.log("Transaction created.");
  console.log("Approving transaction...");
  if (ledger)
    console.log("Please approve the transaction on your ledger device...");
  await squad.approveTransaction(txKey);
  console.log("Transaction approved.");
  console.log(
    `Tx URL: https://mesh${
      cluster === "devnet" ? "-devnet" : ""
    }.squads.so/transactions/${vault.toBase58()}/tx/${txKey.toBase58()}`
  );
}

async function setIsActiveIx(
  payerKey: PublicKey,
  opsOwnerKey: PublicKey,
  attesterProgramId: PublicKey,
  isActive: boolean
): Promise<TransactionInstruction> {
  const [configKey, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("pyth2wormhole-config-v3")],
    attesterProgramId
  );

  const config: AccountMeta = {
    pubkey: configKey,
    isSigner: false,
    isWritable: true,
  };

  const opsOwner: AccountMeta = {
    pubkey: opsOwnerKey,
    isSigner: true,
    isWritable: true,
  };
  const payer: AccountMeta = {
    pubkey: payerKey,
    isSigner: true,
    isWritable: true,
  };

  const isActiveInt = isActive ? 1 : 0;
  // first byte is the isActive instruction, second byte is true/false
  const data = Buffer.from([4, isActiveInt]);

  return {
    keys: [config, opsOwner, payer],
    programId: attesterProgramId,
    data: data,
  };
}

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
        Uint8Array.from(Buffer.from(payload, "hex")),
        "CONFIRMED"
      )
    ),
  ];
}

const getIxAuthority = async (
  txPda: anchor.web3.PublicKey,
  index: anchor.BN,
  programId: anchor.web3.PublicKey
) => {
  return anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("squad"),
      txPda.toBuffer(),
      index.toArrayLike(Buffer, "le", 4),
      anchor.utils.bytes.utf8.encode("ix_authority"),
    ],
    programId
  );
};

async function createWormholeMsgMultisigTx(
  cluster: Cluster,
  squad: Squads,
  ledger: boolean,
  vault: PublicKey,
  payload: string
) {
  const msAccount = await squad.getMultisig(vault);
  const emitter = squad.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Emitter Address: ${emitter.toBase58()}`);

  const txKey = await createTx(squad, ledger, vault);

  const [messagePDA, messagePdaBump] = await getIxAuthority(
    txKey,
    new anchor.BN(1),
    squad.multisigProgramId
  );

  console.log("Creating wormhole instructions...");
  const wormholeIxs = await getWormholeMessageIx(
    cluster,
    emitter,
    emitter,
    messagePDA,
    squad.connection,
    payload
  );
  console.log("Wormhole instructions created.");

  const squadIxs: SquadInstruction[] = [
    { instruction: wormholeIxs[0] },
    {
      instruction: wormholeIxs[1],
      authorityIndex: 1,
      authorityBump: messagePdaBump,
      authorityType: "custom",
    },
  ];

  await addInstructionsToTx(
    cluster,
    squad,
    ledger,
    msAccount.publicKey,
    txKey,
    squadIxs
  );
}

async function executeMultisigTx(
  cluster: string,
  vault: PublicKey,
  ledger: boolean,
  ledgerDerivationAccount: number | undefined,
  ledgerDerivationChange: number | undefined,
  walletPath: string,
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
  const signature = await provider.sendAndConfirm(executeTx);

  console.log(
    `Executed tx: https://explorer.solana.com/tx/${signature}${
      cluster === "devnet" ? "?cluster=devnet" : ""
    }`
  );

  console.log(
    "Sleeping for 10 seconds to allow guardians enough time to get the sequence number..."
  );
  await new Promise((resolve) => setTimeout(resolve, 10000));

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

  console.log(
    "Sleeping for 10 seconds to allow guardians enough time to create VAA..."
  );
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // fetch VAA
  console.log("Fetching VAA...");
  const response = await fetch(
    `${rpcUrl}/v1/signed_vaa/1/${Buffer.from(
      bs58.decode(emitter.toBase58())
    ).toString("hex")}/${sequenceNumber}`
  );
  const { vaaBytes } = await response.json();
  console.log(`VAA (Base64): ${vaaBytes}`);
  console.log(`VAA (Hex): ${Buffer.from(vaaBytes).toString("hex")}`);
  const parsedVaa = await parse(vaaBytes);
  console.log(`Emitter chain: ${parsedVaa.emitter_chain}`);
  console.log(`Nonce: ${parsedVaa.nonce}`);
  console.log(`Payload: ${Buffer.from(parsedVaa.payload).toString("hex")}`);
}

async function parse(data: string) {
  const { parse_vaa } = await importCoreWasm();
  return parse_vaa(Uint8Array.from(Buffer.from(data, "base64")));
}
