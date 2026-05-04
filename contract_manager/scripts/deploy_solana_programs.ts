/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable n/no-process-exit */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

/**
 * Solana Contract Deployment Script
 *
 * Deploys the three Solana programs that make up the Pyth Solana stack:
 *   - wormhole_core_bridge_solana   (Wormhole receiver)
 *   - pyth_solana_receiver          (Pyth price update receiver)
 *   - pyth_push_oracle              (Pyth push oracle)
 *
 * The script wraps `solana program deploy` for the program binaries and the
 * Rust CLI under target_chains/solana/cli for post-deploy initialization
 * (`initialize-wormhole-receiver` and `initialize-pyth-receiver`).
 *
 * The chain is looked up in DefaultStore by id (see SolanaChains.json), so the
 * RPC URL comes from the store rather than being passed in directly.
 *
 * Expected layout of --artifacts-dir (default: target_chains/solana/target/deploy):
 *   <artifacts-dir>/wormhole_core_bridge_solana.so
 *   <artifacts-dir>/wormhole_core_bridge_solana-keypair.json
 *   <artifacts-dir>/pyth_solana_receiver.so
 *   <artifacts-dir>/pyth_solana_receiver-keypair.json
 *   <artifacts-dir>/pyth_push_oracle.so
 *   <artifacts-dir>/pyth_push_oracle-keypair.json
 *
 * Examples:
 *   # Deploy all three programs to devnet, then initialize the wormhole and pyth receivers.
 *   npx tsx scripts/deploy_solana_contracts.ts \
 *     --chain solana_devnet \
 *     --keypair ~/.config/solana/id.json \
 *     --governance-authority <pubkey> \
 *     --source-emitter <pubkey> \
 *     --source-chain 26
 *
 *   # Only deploy the program binaries, skip initialization.
 *   npx tsx scripts/deploy_solana_contracts.ts \
 *     --chain solana_devnet \
 *     --keypair ~/.config/solana/id.json \
 *     --skip-init
 *
 *   # Only run initialization on already-deployed programs.
 *   npx tsx scripts/deploy_solana_contracts.ts \
 *     --chain solana_devnet \
 *     --keypair ~/.config/solana/id.json \
 *     --skip-deploy \
 *     --governance-authority <pubkey> \
 *     --source-emitter <pubkey> \
 *     --source-chain 26
 */

import { execFileSync } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { SolanaChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN, Wallet } from "@coral-xyz/anchor";
import {
  DEFAULT_PUSH_ORACLE_PROGRAM_ID,
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  PythSolanaReceiver,
  getConfigPda,
} from "@pythnetwork/pyth-solana-receiver";
import { IDL as pythSolanaReceiverIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/pyth_solana_receiver";
import { IDL as pythPushOracleIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/pyth_push_oracle";
import { IDL as wormholeCoreBridgeIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/wormhole_core_bridge_solana";
import { utils as wormholeUtils } from "@wormhole-foundation/sdk-solana-core";
import { HermesClient } from "@pythnetwork/hermes-client";
import { sendTransactions } from "@pythnetwork/solana-utils";
import type { Vault } from "../src/node/utils/governance";
import upgradeVaults from "../src/store/vaults/UpgradeVaults.json";
import type { DeploymentConfig } from "../src/core/contracts";
import { getDefaultDeploymentConfig } from "../src/core/base";

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";


const GUARDIAN_EXPIRATION_TIME = 86_400;

const PROGRAMS = [
  "wormhole_core_bridge_solana",
  "pyth_solana_receiver",
  "pyth_push_oracle",
] as const;

type ProgramName = (typeof PROGRAMS)[number];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SOLANA_DIR = path.join(REPO_ROOT, "target_chains", "solana");
const ARTIFACTS_DIR = path.join(SOLANA_DIR, "target", "deploy");
const DEFAULT_KEY_DIR = path.join(os.homedir(), ".config", "solana");
const SOLANA_CLI_DIR = path.join(SOLANA_DIR, "cli");

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_solana_contracts.ts")
  .usage(
    "Usage: $0 --chain <chain-id> --keypair <path>",
  )
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain id from SolanaChains.json (e.g. solana_devnet, solana_mainnet)",
    },
    keypair: {
      type: "string",
      demandOption: true,
      desc: "Path to the payer keypair file",
    },
    "key-dir": {
      type: "string",
      demandOption: false,
      desc: "Path to the directory containing the keypair files",
      default: DEFAULT_KEY_DIR,
    },
    final: {
      type: "boolean",
      demandOption: false,
      default: false,
      desc: "Transfer the program upgrade authority of all deployed programs to the governance vault. On mainnet, also transfer the IDL authority.",
    },
  })
  .strict();

const PYTH_RECEIVER_GOVERNANCE_AUTHORITY = new PublicKey(
  "11111111111111111111111111111111",
);
const PYTH_RECEIVER_SOURCE_EMITTER = new PublicKey(
  "11111111111111111111111111111111",
);
const PYTH_RECEIVER_SOURCE_CHAIN = 26;
const PYTH_RECEIVER_SINGLE_UPDATE_FEE_IN_LAMPORTS = 1;
const PYTH_RECEIVER_MINIMUM_SIGNATURES = 3;

function run(command: string, args: string[], cwd?: string): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    stdio: "inherit",
    cwd,
  });
}

async function isProgramDeployed(connection: Connection, programId: PublicKey): Promise<boolean> {
  const accountInfo = await connection.getAccountInfo(programId, "confirmed");
  return accountInfo !== null && accountInfo.executable;
}

function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.startsWith("~")
    ? path.join(os.homedir(), keypairPath.slice(1))
    : keypairPath;
  const secret = JSON.parse(readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

const INITIAL_GUARDIAN_SET = [
  Buffer.from("41534bb176e461a3fb30479400f210549ecce638", "hex"),
  Buffer.from("6502987b62f21cab7eb5ccd8f0173084b60d5b41", "hex"),
  Buffer.from("44a3e8f6a382412cf6bb90a3f8106e68977476c9", "hex"),
  Buffer.from("d9d7d4529577864352c9a6539a48238fcd447052", "hex"),
  Buffer.from("1663a5a822336ece48559b1dfb1e93a017a7dac3", "hex"),
] // fix me: use base.ts

async function initializeWormholeReceiver(
  connection: Connection,
  payer: Keypair,
): Promise<void> {
  const bridgeKey = wormholeUtils.deriveWormholeBridgeDataKey(DEFAULT_WORMHOLE_PROGRAM_ID);
  const bridgeAccount = await connection.getAccountInfo(bridgeKey, "confirmed");

  if (bridgeAccount !== null) {
    const bridge = wormholeUtils.BridgeData.deserialize(bridgeAccount.data);
    console.log(
      `Wormhole already initialized. guardianSetIndex=${bridge.guardianSetIndex} fee=${bridge.config.fee}`,
    );
    return;
  }

  console.log("\n=== Initializing wormhole receiver ===");
  const ix = wormholeUtils.createInitializeInstruction(
    connection,
    DEFAULT_WORMHOLE_PROGRAM_ID,
    payer.publicKey,
    GUARDIAN_EXPIRATION_TIME,
    0n,
    INITIAL_GUARDIAN_SET,
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer],
    { commitment: "confirmed", skipPreflight: true },
  );
  console.log(`Wormhole initialized. signature=${signature}`);
}

async function initializePythReceiver(
  connection: Connection,
  payer: Keypair,
): Promise<void> {
  const configPda = getConfigPda(DEFAULT_RECEIVER_PROGRAM_ID);
  const existingConfig = await connection.getAccountInfo(configPda, "confirmed");
  if (existingConfig !== null) {
    console.log(
      `Pyth receiver already initialized. config=${configPda.toString()}`,
    );
    return;
  }

  console.log("\n=== Initializing pyth receiver ===");

  const deploymentConfig = getDefaultDeploymentConfig("stable");

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(payer),
  });

  const signature = await pythSolanaReceiver.receiver.methods
    .initialize({
      governanceAuthority: new PublicKey(Buffer.from(deploymentConfig.governanceDataSource.emitterAddress, "hex")),
      targetGovernanceAuthority: null,
      wormhole: DEFAULT_WORMHOLE_PROGRAM_ID,
      validDataSources: [
        {
          chain: 26,
          emitter: new PublicKey(Buffer.from("507974686e6574507974686e6574507974686e6574507974686e657450797468", "hex")), // fix me: use base.ts
        },
      ],
      singleUpdateFeeInLamports: new BN(
        0,
      ),
      minimumSignatures: 3,
    })
    .accounts({ payer: payer.publicKey, config: configPda })
    .signers([payer])
    .rpc({ commitment: "confirmed", skipPreflight: true });
  console.log(`Pyth receiver initialized. signature=${signature}`);
}

function programArtifactPaths(
  program: ProgramName,
  artifactsDir: string,
  keyDir: string,
  programId: PublicKey,
): { soPath: string; keypairPath: string } {
  return {
    soPath: path.join(artifactsDir, `${program}.so`),
    keypairPath: path.join(keyDir, `${programId.toString()}.json`),
  };
}

async function deployProgram(
  program: ProgramName,
  artifactsDir: string,
  keyDir: string,
  programId: PublicKey,
  connection: Connection,
  payerKeypair: string,
): Promise<void> {
  console.log(`\n=== Deploying ${program} ===`);

  const { soPath, keypairPath } = programArtifactPaths(program, artifactsDir, keyDir, programId);
  
  // if (await isProgramDeployed(connection, programId)) {
  //   console.log(
  //     `⏭️  Skipping ${program}: ${programId.toString()} is already deployed`,
  //   );
  //   return;
  // }


  if (!existsSync(soPath)) {
    throw new Error(
      `Missing program binary for ${program} at ${soPath}. Build it with \`anchor build\` (or pass --artifacts-dir).`,
    );
  }
  if (!existsSync(keypairPath)) {
    throw new Error(
      `Missing program keypair for ${program} at ${keypairPath}. Make sure you have the keypair to the program id in the key directory.`,
    );
  }

  run("solana", [
    "program",
    "deploy",
    "--url",
    connection.rpcEndpoint,
    "--keypair",
    payerKeypair,
    "--program-id",
    keyDir + "/" + programId.toString() + ".json",
    soPath,
  ]);
  console.log(`✅ Deployed ${program}`);
}

// Anchor IDL upload protocol — see anchor-syn/src/codegen/program/idl.rs
// and the reference flow in anchor cli/src/lib.rs (`create_idl_account`, `idl_write`).
const IDL_IX_TAG = Buffer.from([
  0x40, 0xf4, 0xbc, 0x78, 0xa7, 0xe9, 0x69, 0x0a,
]);
const IDL_HEADER_SIZE = 44;
const IDL_PDA_MAX_GROWTH = 60_000;
const IDL_RESIZE_STEP = 10_000;
const IDL_WRITE_CHUNK = 600;

function encodeIdlCreate(dataLen: bigint): Buffer {
  const buf = Buffer.alloc(IDL_IX_TAG.length + 1 + 8);
  IDL_IX_TAG.copy(buf, 0);
  buf.writeUInt8(0, IDL_IX_TAG.length);
  buf.writeBigUInt64LE(dataLen, IDL_IX_TAG.length + 1);
  return buf;
}

function encodeIdlResize(dataLen: bigint): Buffer {
  const buf = Buffer.alloc(IDL_IX_TAG.length + 1 + 8);
  IDL_IX_TAG.copy(buf, 0);
  buf.writeUInt8(6, IDL_IX_TAG.length);
  buf.writeBigUInt64LE(dataLen, IDL_IX_TAG.length + 1);
  return buf;
}

function encodeIdlWrite(chunk: Buffer): Buffer {
  const buf = Buffer.alloc(IDL_IX_TAG.length + 1 + 4 + chunk.length);
  IDL_IX_TAG.copy(buf, 0);
  buf.writeUInt8(2, IDL_IX_TAG.length);
  buf.writeUInt32LE(chunk.length, IDL_IX_TAG.length + 1);
  chunk.copy(buf, IDL_IX_TAG.length + 1 + 4);
  return buf;
}

function encodeIdlSetAuthority(newAuthority: PublicKey): Buffer {
  const buf = Buffer.alloc(IDL_IX_TAG.length + 1 + 32);
  IDL_IX_TAG.copy(buf, 0);
  buf.writeUInt8(4, IDL_IX_TAG.length);
  newAuthority.toBuffer().copy(buf, IDL_IX_TAG.length + 1);
  return buf;
}

// BPF Upgradeable Loader program id and its SetAuthority instruction discriminator.
// See https://docs.rs/solana-program/latest/src/solana_program/loader_upgradeable_instruction.rs.html
const BPF_UPGRADEABLE_LOADER_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const BPF_LOADER_SET_AUTHORITY_IX = Buffer.from([4, 0, 0, 0]);

async function transferProgramAuthority(
  program: ProgramName,
  programId: PublicKey,
  connection: Connection,
  payer: Keypair,
  newAuthority: PublicKey,
): Promise<void> {
  console.log(
    `\n=== Transferring upgrade authority of ${program} to ${newAuthority.toString()} ===`,
  );

  const programDataAccount = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADEABLE_LOADER_ID,
  )[0];

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: BPF_UPGRADEABLE_LOADER_ID,
      keys: [
        { pubkey: programDataAccount, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: newAuthority, isSigner: false, isWritable: false },
      ],
      data: BPF_LOADER_SET_AUTHORITY_IX,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`✅ Transferred upgrade authority of ${program} (sig=${signature})`);
}

async function transferIdlAuthority(
  connection: Connection,
  payer: Keypair,
  program: ProgramName,
  programId: PublicKey,
  newAuthority: PublicKey,
): Promise<void> {
  console.log(
    `\n=== Transferring IDL authority of ${program} to ${newAuthority.toString()} ===`,
  );

  const programSigner = PublicKey.findProgramAddressSync([], programId)[0];
  const idlAddress = await PublicKey.createWithSeed(
    programSigner,
    "anchor:idl",
    programId,
  );

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: idlAddress, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data: encodeIdlSetAuthority(newAuthority),
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`✅ Transferred IDL authority of ${program} (sig=${signature})`);
}

async function uploadIdl(
  connection: Connection,
  payer: Keypair,
  program: ProgramName,
  programId: PublicKey,
  idl: unknown,
): Promise<void> {
  console.log(`\n=== Uploading IDL for ${program} ===`);

  const programSigner = PublicKey.findProgramAddressSync([], programId)[0];
  const idlAddress = await PublicKey.createWithSeed(
    programSigner,
    "anchor:idl",
    programId,
  );
  const existing = await connection.getAccountInfo(idlAddress, "confirmed");
  if (existing && existing.data.length > 0) {
    console.log(
      `⏭️  Skipping IDL upload for ${program}: ${idlAddress.toString()} already initialized`,
    );
    return;
  }

  const compressed = deflateSync(Buffer.from(JSON.stringify(idl), "utf8"));
  if (compressed.length > IDL_PDA_MAX_GROWTH) {
    throw new Error(
      `Compressed IDL for ${program} is ${compressed.length} bytes; exceeds ${IDL_PDA_MAX_GROWTH}`,
    );
  }
  const dataLen = BigInt(
    Math.min(compressed.length * 2, IDL_PDA_MAX_GROWTH - IDL_HEADER_SIZE),
  );

  const createTx = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: idlAddress, isSigner: false, isWritable: true },
        { pubkey: programSigner, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
      ],
      data: encodeIdlCreate(dataLen),
    }),
  );
  const numResizes = Math.floor(Number(dataLen) / IDL_RESIZE_STEP);
  for (let i = 0; i < numResizes; i++) {
    createTx.add(
      new TransactionInstruction({
        programId,
        keys: [
          { pubkey: idlAddress, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: encodeIdlResize(dataLen),
      }),
    );
  }

  const createSig = await sendAndConfirmTransaction(connection, createTx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`IDL account created at ${idlAddress.toString()} (sig=${createSig})`);

  for (let offset = 0; offset < compressed.length; offset += IDL_WRITE_CHUNK) {
    const chunk = compressed.subarray(
      offset,
      Math.min(offset + IDL_WRITE_CHUNK, compressed.length),
    );
    const writeTx = new Transaction().add(
      new TransactionInstruction({
        programId,
        keys: [
          { pubkey: idlAddress, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        data: encodeIdlWrite(chunk),
      }),
    );
    await sendAndConfirmTransaction(connection, writeTx, [payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });
    console.log(
      `  wrote ${Math.min(offset + chunk.length, compressed.length)}/${compressed.length} bytes`,
    );
  }
  console.log(`✅ IDL uploaded for ${program}`);
}

async function postPriceUpdate(
  connection: Connection,
  payer: Keypair,
): Promise<void> {
  console.log("\n=== Testing posting a pyth price update ===");

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(payer),
  });

  const hermesClient = new HermesClient("https://pyth.dourolabs.app/hermes", {accessToken: process.env.HERMES_ACCESS_TOKEN ?? "" });
  const priceUpdateData = (
    await hermesClient.getLatestPriceUpdates([SOL_PRICE_FEED_ID], {
      encoding: "base64",
    })
  ).binary.data;
  console.log(`Posting price update: ${priceUpdateData}`);

  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  await transactionBuilder.addUpdatePriceFeed(priceUpdateData, 0);
  console.log(
    "The SOL/USD price update will be posted to:",
    transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58(),
  );

  await sendTransactions(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100_000,
      tightComputeBudget: true,
    }),
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet,
  );
  console.log("Price update posted.");
}

const loadVault = (isMainnet: boolean): Vault => {
  const governanceCluster = isMainnet ? "mainnet-beta" : "devnet";
  const governanceVault = upgradeVaults.find(
    (v) => v.cluster === governanceCluster && v.type === "vault",
  );
  if (!governanceVault)
    throw new Error("Governance vault not found in UpgradeVaults.json");
  const vault = DefaultStore.vaults[`${governanceVault.cluster}_${governanceVault.key}`];
  if (!vault)
    throw new Error("Governance vault not found in DefaultStore.vaults");
  return vault;
}

async function main() {
  const argv = await parser.argv;

  if (argv.chain !== "solana_mainnet" && argv.chain !== "solana_devnet") {
    throw new Error("This tool doesn't yet support generic SVM chains")    
  }

  const chain = DefaultStore.getChainOrThrow(argv.chain, SolanaChain);
  const vault = loadVault(chain.isMainnet());
  const url = chain.rpcUrl;
  const keyDir = path.resolve(argv["key-dir"]);
  const connection = new Connection(url, "confirmed");

  const artifactsDir = path.resolve(ARTIFACTS_DIR);
  if (!existsSync(artifactsDir)) {
    throw new Error(`Artifacts directory does not exist: ${artifactsDir}`);
  }

  // const selectedPrograms = argv.programs as ProgramName[];

  console.log("Deployment configuration:");
  console.log(`  Chain:          ${chain.getId()} (${chain.wormholeChainName})`);
  console.log(`  RPC URL:        ${url}`);
  console.log(`  Payer keypair:  ${argv.keypair}`);
  console.log(`  Artifacts dir:  ${artifactsDir}`);

  await deployProgram(
    "wormhole_core_bridge_solana",
    artifactsDir,
    keyDir,
    DEFAULT_WORMHOLE_PROGRAM_ID,
    connection,
    argv.keypair,
  );
  await deployProgram(
    "pyth_solana_receiver",
    artifactsDir,
    keyDir,
    DEFAULT_RECEIVER_PROGRAM_ID,
    connection,
    argv.keypair,
  );
  await deployProgram(
    "pyth_push_oracle",
    artifactsDir,
    keyDir,
    DEFAULT_PUSH_ORACLE_PROGRAM_ID,
    connection,
    argv.keypair,
  );

  const payer = loadKeypair(argv.keypair);
  await uploadIdl(
    connection,
    payer,
    "wormhole_core_bridge_solana",
    DEFAULT_WORMHOLE_PROGRAM_ID,
    wormholeCoreBridgeIdl,
  );
  await uploadIdl(
    connection,
    payer,
    "pyth_solana_receiver",
    DEFAULT_RECEIVER_PROGRAM_ID,
    pythSolanaReceiverIdl,
  );
  await uploadIdl(
    connection,
    payer,
    "pyth_push_oracle",
    DEFAULT_PUSH_ORACLE_PROGRAM_ID,
    pythPushOracleIdl,
  );

  await initializeWormholeReceiver(connection, payer);
  await initializePythReceiver(connection, payer);
  await postPriceUpdate(connection, payer);

  if (argv.final) {
    const newAuthority = await vault.getEmitter();
    console.log(
      `\nFinalization step: transferring authorities to vault ${vault.key.toString()} (authority PDA: ${newAuthority.toString()})`,
    );

    const programs = [
      ["wormhole_core_bridge_solana", DEFAULT_WORMHOLE_PROGRAM_ID],
      ["pyth_solana_receiver", DEFAULT_RECEIVER_PROGRAM_ID],
      ["pyth_push_oracle", DEFAULT_PUSH_ORACLE_PROGRAM_ID],
    ] as const;

    for (const [program, programId] of programs) {
      await transferProgramAuthority(
        program,
        programId,
        connection,
        payer,
        newAuthority,
      );
    }

    if (chain.isMainnet()) {
      for (const [program, programId] of programs) {
        await transferIdlAuthority(
          connection,
          payer,
          program,
          programId,
          newAuthority,
        );
      }
    }
  }

  console.log("\nAll done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
