import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { BN, Wallet } from "@coral-xyz/anchor";
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  getConfigPda,
  LAZER_PUSH_ORACLE_PROGRAM_ID,
  LAZER_RECEIVER_PROGRAM_ID,
  LAZER_WORMHOLE_PROGRAM_ID,
  PythSolanaReceiver,
} from "@pythnetwork/pyth-solana-receiver";
import { sendTransactions } from "@pythnetwork/solana-utils";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { utils as wormholeUtils } from "@wormhole-foundation/sdk-solana-core";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { IDL as pythPushOracleIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/pyth_push_oracle";
import { IDL as pythSolanaReceiverIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/pyth_solana_receiver";
import { IDL as wormholeCoreBridgeIdl } from "../../target_chains/solana/sdk/js/pyth_solana_receiver/src/idl/wormhole_core_bridge_solana";
import { getDefaultDeploymentConfig } from "../src/core/base";
import { SvmChain } from "../src/core/chains";
import type { Vault } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SOLANA_DIR = path.join(REPO_ROOT, "target_chains", "solana");
const ARTIFACTS_DIR = path.join(SOLANA_DIR, "target", "deploy");
const DEFAULT_KEY_DIR = path.join(os.homedir(), ".config", "solana");


const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_solana_contracts.ts")
  .usage("Usage: $0 --chain <chain-id> --keypair <path>")
  .options({
    chain: {
      demandOption: true,
      desc: "Chain id from SolanaChains.json (e.g. solana_devnet, solana_mainnet)",
      type: "string",
    },
    final: {
      default: false,
      demandOption: false,
      desc: "Transfer the program upgrade authority of all deployed programs to the governance vault. On mainnet, also transfer the IDL authority.",
      type: "boolean",
    },
    "key-dir": {
      default: DEFAULT_KEY_DIR,
      demandOption: false,
      desc: "Path to the directory containing the keypair files",
      type: "string",
    },
    keypair: {
      demandOption: true,
      desc: "Path to the payer keypair file",
      type: "string",
    },
  })
  .strict();

const loadGovernanceVault = (isMainnet: boolean): Vault => {
  const governanceEnvironment = isMainnet ? "mainnet-beta" : "devnet";
  const vault = Object.entries(DefaultStore.vaults).find(([id]) =>
    id.startsWith(governanceEnvironment + "_"),
  )?.[1];
  if (!vault) {
    throw new Error(`Could not find ${governanceEnvironment} vault.`);
  }
  return vault;
};

function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.startsWith("~")
    ? path.join(os.homedir(), keypairPath.slice(1))
    : keypairPath;
  const secret = JSON.parse(readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

const PROGRAMS_TO_DEPLOY = [
  ["wormhole_core_bridge_solana", LAZER_WORMHOLE_PROGRAM_ID, wormholeCoreBridgeIdl],
  ["pyth_solana_receiver", LAZER_RECEIVER_PROGRAM_ID, pythSolanaReceiverIdl],
  ["pyth_push_oracle", LAZER_PUSH_ORACLE_PROGRAM_ID, pythPushOracleIdl],
] as const;

type ProgramName = (typeof PROGRAMS_TO_DEPLOY)[number][0];

function programArtifactPaths(
  program: ProgramName,
  artifactsDir: string,
  keyDir: string,
  programId: PublicKey,
): { soPath: string; keypairPath: string } {
  return {
    keypairPath: path.join(keyDir, `${programId.toString()}.json`),
    soPath: path.join(artifactsDir, `${program}.so`),
  };
}

async function isProgramDeployed(
  connection: Connection,
  programId: PublicKey,
): Promise<boolean> {
  const accountInfo = await connection.getAccountInfo(programId);
  return accountInfo !== null && accountInfo.executable;
}

function run(command: string, args: string[], cwd?: string): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
}

async function deployProgram(
  program: ProgramName,
  artifactsDir: string,
  keyDir: string,
  programId: PublicKey,
  connection: Connection,
  payerKeypairPath: string,
): Promise<void> {
  console.log(`\n=== Deploying ${program} ===`);

  const { soPath, keypairPath } = programArtifactPaths(
    program,
    artifactsDir,
    keyDir,
    programId,
  );

  if (await isProgramDeployed(connection, programId)) {
    console.log(
      `⏭️  Skipping ${program}: ${programId.toString()} is already deployed`,
    );
    return;
  }

  if (!existsSync(soPath)) {
    throw new Error(
      `Missing program binary for ${program} at ${soPath}. Build it with cargo-build-sbf --features lazer.`,
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
    payerKeypairPath,
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
      data: encodeIdlCreate(dataLen),
      keys: [
        { isSigner: true, isWritable: false, pubkey: payer.publicKey },
        { isSigner: false, isWritable: true, pubkey: idlAddress },
        { isSigner: false, isWritable: false, pubkey: programSigner },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
        { isSigner: false, isWritable: false, pubkey: programId },
      ],
      programId,
    }),
  );
  const numResizes = Math.floor(Number(dataLen) / IDL_RESIZE_STEP);
  for (let i = 0; i < numResizes; i++) {
    createTx.add(
      new TransactionInstruction({
        data: encodeIdlResize(dataLen),
        keys: [
          { isSigner: false, isWritable: true, pubkey: idlAddress },
          { isSigner: true, isWritable: false, pubkey: payer.publicKey },
          {
            isSigner: false,
            isWritable: false,
            pubkey: SystemProgram.programId,
          },
        ],
        programId,
      }),
    );
  }

  const createSig = await sendAndConfirmTransaction(
    connection,
    createTx,
    [payer],
    {
      commitment: "confirmed",
      skipPreflight: true,
    },
  );
  console.log(
    `IDL account created at ${idlAddress.toString()} (sig=${createSig})`,
  );

  for (let offset = 0; offset < compressed.length; offset += IDL_WRITE_CHUNK) {
    const chunk = compressed.subarray(
      offset,
      Math.min(offset + IDL_WRITE_CHUNK, compressed.length),
    );
    const writeTx = new Transaction().add(
      new TransactionInstruction({
        data: encodeIdlWrite(chunk),
        keys: [
          { isSigner: false, isWritable: true, pubkey: idlAddress },
          { isSigner: true, isWritable: false, pubkey: payer.publicKey },
        ],
        programId,
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

const GUARDIAN_EXPIRATION_TIME = 86_400;

async function initializeWormholeReceiver(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey,
): Promise<void> {
  const deploymentConfig = getDefaultDeploymentConfig("lazer-prod");
  const bridgeKey = wormholeUtils.deriveWormholeBridgeDataKey(
    programId,
  );
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
    programId,
    payer.publicKey,
    GUARDIAN_EXPIRATION_TIME,
    0n,
    deploymentConfig.wormholeConfig.initialGuardianSet.map((guardian) => Buffer.from(guardian, "hex")),
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
  wormholeProgramId: PublicKey,
  receiverProgramId: PublicKey,
  vault: Vault,
): Promise<void> {
  const configPda = getConfigPda(receiverProgramId);
  const existingConfig = await connection.getAccountInfo(
    configPda,
    "confirmed",
  );
  if (existingConfig !== null) {
    console.log(
      `Pyth receiver already initialized. config=${configPda.toString()}`,
    );
    return;
  }

  console.log("\n=== Initializing pyth receiver ===");

  const deploymentConfig = getDefaultDeploymentConfig("lazer-prod");

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(payer),
    receiverProgramId
  });

  const signature = await pythSolanaReceiver.receiver.methods
    .initialize({
      governanceAuthority: vault.getEmitter(),
      minimumSignatures: 3,
      singleUpdateFeeInLamports: new BN(0),
      targetGovernanceAuthority: null,
      validDataSources: [
        {
          chain: deploymentConfig.dataSources[0].emitterChain,
          emitter: new PublicKey(
            Buffer.from(deploymentConfig.dataSources[0].emitterAddress, "hex"),
          ),
        },
      ],
      wormhole: wormholeProgramId,
    })
    .accounts({ config: configPda, payer: payer.publicKey })
    .signers([payer])
    .rpc({ commitment: "confirmed", skipPreflight: true });
  console.log(`Pyth receiver initialized. signature=${signature}`);
}

const SOL_USD_HERMES_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";


async function updatePriceFeed(
  connection: Connection,
  payer: Keypair,
  wormholeProgramId: PublicKey,
  receiverProgramId: PublicKey,
  pushOracleProgramId: PublicKey,
): Promise<void> {
  console.log("\n=== Testing updating a price feed account ===");

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(payer),
    wormholeProgramId,
    receiverProgramId,
    pushOracleProgramId,
  });

  if (process.env.HERMES_ACCESS_TOKEN === undefined) {
    throw new Error("This step requires a Lazer access token. Please set the HERMES_ACCESS_TOKEN environment variable.");
  }
  const hermesClient = new HermesClient("https://pyth.dourolabs.app/hermes", { accessToken: process.env.HERMES_ACCESS_TOKEN });
  const priceUpdateData = (
    await hermesClient.getLatestPriceUpdates([SOL_USD_HERMES_ID], {
      encoding: "base64",
    })
  ).binary.data;

  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
    closeUpdateAccounts: true,
  });
  await transactionBuilder.addUpdatePriceFeed(priceUpdateData, 0);
  await sendTransactions(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 100_000,
      tightComputeBudget: true,
    }),
    pythSolanaReceiver.connection,
    pythSolanaReceiver.wallet,
  );
  console.log("Price update posted successfully.");
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
      data: BPF_LOADER_SET_AUTHORITY_IX,
      keys: [
        { isSigner: false, isWritable: true, pubkey: programDataAccount },
        { isSigner: true, isWritable: false, pubkey: payer.publicKey },
        { isSigner: false, isWritable: false, pubkey: newAuthority },
      ],
      programId: BPF_UPGRADEABLE_LOADER_ID,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(
    `✅ Transferred upgrade authority of ${program} (sig=${signature})`,
  );
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
      data: encodeIdlSetAuthority(newAuthority),
      keys: [
        { isSigner: false, isWritable: true, pubkey: idlAddress },
        { isSigner: true, isWritable: false, pubkey: payer.publicKey },
      ],
      programId,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`✅ Transferred IDL authority of ${program} (sig=${signature})`);
}

async function main() {
  const argv = await parser.argv;

  if (argv.chain !== "solana_mainnet" && argv.chain !== "solana_devnet") {
    throw new Error("This tool doesn't yet support generic SVM chains");
  }

  const chain = DefaultStore.getChainOrThrow(argv.chain, SvmChain);
  const vault = loadGovernanceVault(chain.isMainnet());
  const connection = chain.getConnection();

  const keyDir = path.resolve(argv["key-dir"]);
  if (!existsSync(keyDir)) {
    throw new Error(`Key directory does not exist: ${keyDir}`);
  }

  const artifactsDir = path.resolve(ARTIFACTS_DIR);
  if (!existsSync(artifactsDir)) {
    throw new Error(`Artifacts directory does not exist: ${artifactsDir}`);
  }

  const keypair = loadKeypair(argv.keypair);

  console.log("Deployment configuration:");
  console.log(
    `  Chain:          ${chain.getId()} (${chain.wormholeChainName})`,
  );
  console.log(`  RPC URL:        ${chain.rpcUrl}`);
  console.log(`  Payer keypair:  ${argv.keypair}`);
  console.log(`  Key dir:        ${keyDir}`);
  console.log(`  Artifacts dir:  ${artifactsDir}`);
  if (argv.final) {
    console.log(`  Final: the upgrade authorities of the programs will be transferred to the vault authority: ${vault.getEmitter().toString()}`);
  }

  for (const [program, programId] of PROGRAMS_TO_DEPLOY) {
    await deployProgram(
      program,
      artifactsDir,
      keyDir,
      programId,
      connection,
      argv.keypair,
    );
  }

  for (const [program, programId, programIdl] of PROGRAMS_TO_DEPLOY) {
    await uploadIdl(
      connection,
      keypair,
      program,
      programId,
      programIdl,
    );
  }

  await initializeWormholeReceiver(connection, keypair, LAZER_WORMHOLE_PROGRAM_ID);
  await initializePythReceiver(connection, keypair, LAZER_WORMHOLE_PROGRAM_ID, LAZER_RECEIVER_PROGRAM_ID, vault);
  await updatePriceFeed(connection, keypair, LAZER_WORMHOLE_PROGRAM_ID, LAZER_RECEIVER_PROGRAM_ID, LAZER_PUSH_ORACLE_PROGRAM_ID);

  if (argv.final) {
    const newAuthority = await vault.getEmitter();
    console.log(
      `\nFinalization step: transferring authorities to vault ${vault.key.toString()} (authority PDA: ${newAuthority.toString()})`,
    );

    for (const [program, programId] of PROGRAMS_TO_DEPLOY) {
      await transferProgramAuthority(
        program,
        programId,
        connection,
        keypair,
        newAuthority,
      );
    }

    if (chain.isMainnet()) {
      for (const [program, programId] of PROGRAMS_TO_DEPLOY) {
        await transferIdlAuthority(
          connection,
          keypair,
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
