import { ixFromRust } from "@certusone/wormhole-sdk";
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
import * as fs from "fs";
import { LedgerNodeWallet } from "./wallet";
import lodash from "lodash";
import { WormholeNetwork, WormholeTools, parse } from "./wormhole";

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
    vault: new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"),
    wormholeRpcEndpoint: "http://guardian:7071",
  },
};

export async function getSquadsClient(
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

export async function createTx(
  squad: Squads,
  vault: PublicKey
): Promise<PublicKey> {
  const msAccount = await squad.getMultisig(vault);

  console.log("Creating new transaction...");
  const newTx = await squad.createTransaction(
    msAccount.publicKey,
    msAccount.authorityIndex
  );
  console.log(`Tx Address: ${newTx.publicKey.toBase58()}`);

  return newTx.publicKey;
}

export type SquadInstruction = {
  instruction: anchor.web3.TransactionInstruction;
  authorityIndex?: number;
  authorityBump?: number;
  authorityType?: string;
};

/** Adds the given instructions to the squads transaction at `txKey` and activates the transaction (makes it ready for signing). */
export async function addInstructionsToTx(
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

export async function setIsActiveIx(
  payerKey: PublicKey,
  opsOwnerKey: PublicKey,
  attesterProgramId: PublicKey,
  isActive: boolean
): Promise<TransactionInstruction> {
  const [configKey] = PublicKey.findProgramAddressSync(
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

export function getWormholeMessageIx(
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

export async function createWormholeMsgMultisigTx(
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

export function areEqualOnChainInstructions(
  instructions: TransactionInstruction[],
  onChainInstructions: InstructionAccount[]
): boolean {
  if (instructions.length != onChainInstructions.length) {
    console.debug(
      `Proposals have a different number of instructions ${instructions.length} vs ${onChainInstructions.length}`
    );
    return false;
  } else {
    return lodash
      .range(0, instructions.length)
      .every((i) =>
        isEqualOnChainInstruction(instructions[i], onChainInstructions[i])
      );
  }
}

export function hasWormholePayload(
  squad: Squads,
  emitter: PublicKey,
  txPubkey: PublicKey,
  payload: string,
  onChainInstructions: InstructionAccount[],
  wormholeTools: WormholeTools
): boolean {
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

  return areEqualOnChainInstructions(wormholeIxs, onChainInstructions);
}

export function isEqualOnChainInstruction(
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

export async function executeMultisigTx(
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

export async function changeThreshold(
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

export async function addMember(
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

export async function removeMember(
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

export function loadInstructionsFromJson(path: string): SquadInstruction[] {
  const inputInstructions = JSON.parse(fs.readFileSync(path).toString());
  const instructions: SquadInstruction[] = inputInstructions.map(
    (ix: any): SquadInstruction => {
      return {
        instruction: new TransactionInstruction({
          programId: new PublicKey(ix.program_id),
          keys: ix.accounts.map((acc: any) => {
            return {
              pubkey: new PublicKey(acc.pubkey),
              isSigner: acc.is_signer,
              isWritable: acc.is_writable,
            };
          }),
          data: Buffer.from(ix.data, "hex"),
        }),
      };
    }
  );
  return instructions;
}
