import { ixFromRust, setDefaultWasm } from "@certusone/wormhole-sdk";
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
import { getIxAuthorityPDA } from "@sqds/mesh";
import { InstructionAccount } from "@sqds/mesh/lib/types";
import bs58 from "bs58";
import { program } from "commander";
import * as fs from "fs";
import { LedgerNodeWallet } from "./wallet";
import lodash from "lodash";
import {
  getActiveProposals,
  getManyProposalsInstructions,
  getProposalInstructions,
} from "./multisig";
import {
  WormholeNetwork,
  loadWormholeTools,
  WormholeTools,
  parse,
} from "./wormhole";

setDefaultWasm("node");

// NOTE(2022-11-30): Naming disambiguation:
// - "mainnet" - always means a public production environment
//
// - "testnet" in Wormhole context - a collection of public testnets
//   of the supported blockchain
// - "testnet" in Solana context - Never used here; The public solana
//   cluster called "testnet" at https://api.testnet.solana.com
//
// - "devnet" in Wormhole context - local Tilt devnet
// - "devnet" in Solana context - The "devnet" public Solana cluster
//   at https://api.devnet.solana.com
//
// - "localdevnet" - always means the Tilt devnet

export type Cluster = "devnet" | "mainnet" | "localdevnet";

type Config = {
  wormholeClusterName: WormholeNetwork;
  wormholeRpcEndpoint: string;
  vault: PublicKey;
};

export const CONFIG: Record<Cluster, Config> = {
  devnet: {
    wormholeClusterName: "TESTNET",
    vault: new PublicKey("6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"),
    wormholeRpcEndpoint: "https://wormhole-v2-testnet-api.certus.one",
  },
  mainnet: {
    wormholeClusterName: "MAINNET",
    vault: new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"),
    wormholeRpcEndpoint: "https://wormhole-v2-mainnet-api.certus.one",
  },
  localdevnet: {
    wormholeClusterName: "DEVNET",
    vault: new PublicKey("DFkA5ubJSETKiFnniAsm8qRXUa7RrnnE7U9awTzbcrJF"),
    wormholeRpcEndpoint: "http://guardian:7071",
  },
};

program
  .name("pyth-multisig")
  .description("CLI to creating and executing multisig transactions for pyth")
  .version("0.1.0");

program
  .command("init-vault")
  .description(
    "Initialize a new multisig vault. NOTE: It's unlikely that you need run this manually. Primarily used in the Tilt local devnet"
  )
  .requiredOption(
    "-k --create-key <address>",
    "Vault create key. It's a pubkey used to seed the vault's address"
  )
  .requiredOption(
    "-x --external-authority <address>",
    "External authority address"
  )
  .option("-c --cluster <network>", "solana cluster to use", "devnet")
  .option("-p --payer <filepath>", "payer keypair file")
  .option(
    "-t --threshold <threshold_number>",
    "Approval quorum threshold for the vault",
    "2"
  )
  .requiredOption(
    "-i --initial-members <comma_separated_members>",
    "comma-separated list of initial multisig members, without spaces"
  )
  .option(
    "-r --solana-rpc <url>",
    "Solana RPC address to use",
    "http://localhost:8899"
  )
  .action(async (options: any) => {
    let cluster: Cluster = options.cluster;
    let createKeyAddr: PublicKey = new PublicKey(options.createKey);
    let extAuthorityAddr: PublicKey = new PublicKey(options.externalAuthority);

    let threshold: number = parseInt(options.threshold, 10);

    let initialMembers = options.initialMembers
      .split(",")
      .map((m: string) => new PublicKey(m));

    let mesh = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.payer,
      cluster == "localdevnet" ? options.solanaRpc : undefined
    );

    let vaultAddr = CONFIG[cluster].vault;
    console.log("Creating new vault at", vaultAddr.toString());

    try {
      let _multisig = await mesh.getMultisig(vaultAddr);

      // NOTE(2022-12-08): If this check prevents you from iterating dev
      // work in tilt, restart solana-devnet.
      console.log(
        "Reached an existing vault under the address, refusing to create."
      );
      process.exit(17); // EEXIST
    } catch (e: any) {}
    console.log("No existing vault found, creating...");
    await mesh.createMultisig(
      extAuthorityAddr,
      threshold,
      createKeyAddr,
      initialMembers
    );
  });

program
  .command("create")
  .description("Create a new multisig transaction")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .option("-s, --skip-duplicate-check", "Skip checking duplicates")
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    const wormholeTools = await loadWormholeTools(cluster, squad.connection);

    if (!options.skipDuplicateCheck) {
      const activeProposals = await getActiveProposals(
        squad,
        CONFIG[cluster].vault
      );
      const activeInstructions = await getManyProposalsInstructions(
        squad,
        activeProposals
      );

      const msAccount = await squad.getMultisig(CONFIG[cluster].vault);
      const emitter = squad.getAuthorityPDA(
        msAccount.publicKey,
        msAccount.authorityIndex
      );

      for (let i = 0; i < activeProposals.length; i++) {
        if (
          hasWormholePayload(
            squad,
            emitter,
            activeProposals[i].publicKey,
            options.payload,
            activeInstructions[i],
            wormholeTools
          )
        ) {
          console.log(
            `❌ Skipping, payload ${options.payload} matches instructions at ${activeProposals[i].publicKey}`
          );
          return;
        }
      }
    }

    await createWormholeMsgMultisigTx(
      options.cluster,
      squad,
      CONFIG[cluster].vault,
      options.payload,
      wormholeTools
    );
  });

program
  .command("verify")
  .description("Verify given wormhole transaction has the given payload")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .requiredOption("-p, --payload <hex-string>", "expected payload")
  .requiredOption("-t, --tx-pda <address>", "transaction PDA")
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    const wormholeTools = await loadWormholeTools(cluster, squad.connection);

    let onChainInstructions = await getProposalInstructions(
      squad,
      await squad.getTransaction(new PublicKey(options.txPda))
    );

    const msAccount = await squad.getMultisig(CONFIG[cluster].vault);
    const emitter = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    if (
      hasWormholePayload(
        squad,
        emitter,
        new PublicKey(options.txPda),
        options.payload,
        onChainInstructions,
        wormholeTools
      )
    ) {
      console.log(
        "✅ This proposal is verified to be created with the given payload."
      );
    } else {
      console.log("❌ This proposal does not match the given payload.");
    }
  });

program
  .command("set-is-active")
  .description(
    "Create a new multisig transaction to set the attester is-active flag"
  )
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
    const cluster = options.cluster as Cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    const vaultPubkey = CONFIG[cluster].vault;
    const msAccount = await squad.getMultisig(vaultPubkey);

    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );
    const attesterProgramId = new PublicKey(options.attester);
    const txKey = await createTx(squad, vaultPubkey);

    let isActive = undefined;
    if (options.isActive === "true") {
      isActive = true;
    } else if (options.isActive === "false") {
      isActive = false;
    } else {
      throw new Error(
        `Illegal argument for --is-active. Expected "true" or "false", got "${options.isActive}"`
      );
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
      msAccount.publicKey,
      txKey,
      squadIxs
    );
  });

program
  .command("execute")
  .description("Execute a multisig transaction that is ready")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    executeMultisigTx(
      cluster,
      squad,
      CONFIG[cluster].vault,
      new PublicKey(options.txPda),
      CONFIG[cluster].wormholeRpcEndpoint,
      await loadWormholeTools(cluster, squad.connection)
    );
  });

program
  .command("change-threshold")
  .description("Change threshold of multisig")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .option("-t, --threshold <number>", "new threshold")
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    await changeThreshold(
      options.cluster,
      squad,
      CONFIG[cluster].vault,
      options.threshold
    );
  });

program
  .command("add-member")
  .description("Add member to multisig")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .option("-m, --member <address>", "new member address")
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );

    await addMember(
      options.cluster,
      squad,
      CONFIG[cluster].vault,
      new PublicKey(options.member)
    );
  });

program
  .command("remove-member")
  .description("Remove member from multisig")
  .option("-c, --cluster <network>", "solana cluster to use", "devnet")
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
  .option("-m, --member <address>", "old member address")
  .action(async (options) => {
    const cluster: Cluster = options.cluster;
    const squad = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.wallet
    );
    await removeMember(
      options.cluster,
      squad,
      CONFIG[cluster].vault,
      new PublicKey(options.member)
    );
  });

// TODO: add subcommand for creating governance messages in the right format

program.parse();

async function getSquadsClient(
  cluster: Cluster,
  ledger: boolean,
  ledgerDerivationAccount: number | undefined,
  ledgerDerivationChange: number | undefined,
  walletPath: string,
  solRpcUrl?: string
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
  switch (cluster) {
    case "devnet": {
      return Squads.devnet(wallet);
      break;
    }
    case "mainnet": {
      return Squads.mainnet(wallet);
      break;
    }
    case "localdevnet": {
      if (solRpcUrl) {
        return Squads.endpoint(solRpcUrl, wallet);
      } else {
        return Squads.localnet(wallet);
      }
    }
    default: {
      throw `ERROR: unrecognized cluster ${cluster}`;
    }
  }
}

async function createTx(squad: Squads, vault: PublicKey): Promise<PublicKey> {
  const msAccount = await squad.getMultisig(vault);

  console.log("Creating new transaction...");
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
  vault: PublicKey,
  txKey: PublicKey,
  instructions: SquadInstruction[]
) {
  for (let i = 0; i < instructions.length; i++) {
    console.log(
      `Adding instruction ${i + 1}/${instructions.length} to transaction...`
    );
    await squad.addInstruction(
      txKey,
      instructions[i].instruction,
      instructions[i].authorityIndex,
      instructions[i].authorityBump,
      instructions[i].authorityType
    );
  }

  console.log("Activating transaction...");
  await squad.activateTransaction(txKey);
  console.log("Transaction created.");
  console.log("Approving transaction...");
  await squad.approveTransaction(txKey);
  console.log("Transaction approved.");
  console.log(`Tx key: ${txKey}`);
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

function getWormholeMessageIx(
  payer: PublicKey,
  emitter: PublicKey,
  message: PublicKey,
  payload: string,
  wormholeTools: WormholeTools
) {
  if (payload.startsWith("0x")) {
    payload = payload.substring(2);
  }

  return [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: wormholeTools.feeCollector,
      lamports: wormholeTools.bridgeFee,
    }),
    ixFromRust(
      wormholeTools.post_message_ix(
        wormholeTools.wormholeAddress.toBase58(),
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

async function createWormholeMsgMultisigTx(
  cluster: Cluster,
  squad: Squads,
  vault: PublicKey,
  payload: string,
  wormholeTools: WormholeTools
) {
  const msAccount = await squad.getMultisig(vault);
  const emitter = squad.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Emitter Address: ${emitter.toBase58()}`);

  const txKey = await createTx(squad, vault);

  const [messagePDA, messagePdaBump] = getIxAuthorityPDA(
    txKey,
    new anchor.BN(1),
    squad.multisigProgramId
  );

  console.log("Creating wormhole instructions...");
  const wormholeIxs = getWormholeMessageIx(
    emitter,
    emitter,
    messagePDA,
    payload,
    wormholeTools
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
    msAccount.publicKey,
    txKey,
    squadIxs
  );
}

function hasWormholePayload(
  squad: Squads,
  emitter: PublicKey,
  txPubkey: PublicKey,
  payload: string,
  onChainInstructions: InstructionAccount[],
  wormholeTools: WormholeTools
): boolean {
  if (onChainInstructions.length !== 2) {
    console.debug(
      `Expected 2 instructions in the transaction, found ${onChainInstructions.length}`
    );
    return false;
  }

  const [messagePDA] = getIxAuthorityPDA(
    txPubkey,
    new anchor.BN(1),
    squad.multisigProgramId
  );

  const wormholeIxs = getWormholeMessageIx(
    emitter,
    emitter,
    messagePDA,
    payload,
    wormholeTools
  );

  return (
    isEqualOnChainInstruction(
      wormholeIxs[0],
      onChainInstructions[0] as InstructionAccount
    ) &&
    isEqualOnChainInstruction(
      wormholeIxs[1],
      onChainInstructions[1] as InstructionAccount
    )
  );
}

function isEqualOnChainInstruction(
  instruction: TransactionInstruction,
  onChainInstruction: InstructionAccount
): boolean {
  if (!instruction.programId.equals(onChainInstruction.programId)) {
    console.debug(
      `Program id mismatch: Expected ${instruction.programId.toBase58()}, found ${onChainInstruction.programId.toBase58()}`
    );
    return false;
  }

  if (!lodash.isEqual(instruction.keys, onChainInstruction.keys)) {
    console.debug(
      `Instruction accounts mismatch. Expected ${instruction.keys}, found ${onChainInstruction.keys}`
    );
    return false;
  }

  const onChainData = onChainInstruction.data as Buffer;
  if (!instruction.data.equals(onChainData)) {
    console.debug(
      `Instruction data mismatch. Expected ${instruction.data.toString(
        "hex"
      )}, Found ${onChainData.toString("hex")}`
    );
    return false;
  }
  return true;
}

async function executeMultisigTx(
  cluster: string,
  squad: Squads,
  vault: PublicKey,
  txPDA: PublicKey,
  rpcUrl: string,
  wormholeTools: WormholeTools
) {
  const msAccount = await squad.getMultisig(vault);

  const emitter = squad.getAuthorityPDA(
    msAccount.publicKey,
    msAccount.authorityIndex
  );

  const tx = await squad.getTransaction(txPDA);
  if ((tx.status as any).executeReady === undefined) {
    console.log(
      `Transaction is either executed or not ready yet. Status: ${JSON.stringify(
        tx.status
      )}`
    );
    return;
  }

  const executeIx = await squad.buildExecuteTransaction(
    txPDA,
    squad.wallet.publicKey
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
    feePayer: squad.wallet.publicKey,
  });
  const provider = new anchor.AnchorProvider(squad.connection, squad.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  executeTx.add(executeIx);

  console.log("Sending transaction...");
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
  console.log(`VAA (Hex): ${Buffer.from(vaaBytes, "base64").toString("hex")}`);
  const parsedVaa = parse(vaaBytes, wormholeTools);
  console.log(`Emitter chain: ${parsedVaa.emitter_chain}`);
  console.log(`Nonce: ${parsedVaa.nonce}`);
  console.log(`Payload: ${Buffer.from(parsedVaa.payload).toString("hex")}`);
}

async function changeThreshold(
  cluster: Cluster,
  squad: Squads,
  vault: PublicKey,
  threshold: number
) {
  const msAccount = await squad.getMultisig(vault);
  const txKey = await createTx(squad, vault);
  const ix = await squad.buildChangeThresholdMember(
    msAccount.publicKey,
    msAccount.externalAuthority,
    threshold
  );

  const squadIxs: SquadInstruction[] = [{ instruction: ix }];
  await addInstructionsToTx(
    cluster,
    squad,
    msAccount.publicKey,
    txKey,
    squadIxs
  );
}

async function addMember(
  cluster: Cluster,
  squad: Squads,
  vault: PublicKey,
  member: PublicKey
) {
  const msAccount = await squad.getMultisig(vault);
  const txKey = await createTx(squad, vault);
  const ix = await squad.buildAddMember(
    msAccount.publicKey,
    msAccount.externalAuthority,
    member
  );

  const squadIxs: SquadInstruction[] = [{ instruction: ix }];
  await addInstructionsToTx(
    cluster,
    squad,
    msAccount.publicKey,
    txKey,
    squadIxs
  );
}

async function removeMember(
  cluster: Cluster,
  squad: Squads,
  vault: PublicKey,
  member: PublicKey
) {
  const msAccount = await squad.getMultisig(vault);
  const txKey = await createTx(squad, vault);
  const ix = await squad.buildRemoveMember(
    msAccount.publicKey,
    msAccount.externalAuthority,
    member
  );

  const squadIxs: SquadInstruction[] = [{ instruction: ix }];
  await addInstructionsToTx(
    cluster,
    squad,
    msAccount.publicKey,
    txKey,
    squadIxs
  );
}
