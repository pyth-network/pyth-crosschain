import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { program } from "commander";
import {
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import fs from "fs";
import SquadsMesh from "@sqds/mesh";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  BPF_UPGRADABLE_LOADER,
  getMultisigCluster,
  getProposalInstructions,
  isRemoteCluster,
  mapKey,
  MultisigParser,
  PROGRAM_AUTHORITY_ESCROW,
  proposeInstructions,
  WORMHOLE_ADDRESS,
} from "xc_admin_common";
import { pythOracleProgram } from "@pythnetwork/client";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { LedgerNodeWallet } from "./ledger";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

export async function loadHotWalletOrLedger(
  wallet: string,
  lda: number,
  ldc: number
): Promise<Wallet> {
  if (wallet === "ledger") {
    return await LedgerNodeWallet.createWallet(lda, ldc);
  } else {
    return new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(wallet, "ascii")))
      )
    );
  }
}

const multisigCommand = (name: string, description: string) =>
  program
    .command(name)
    .description(description)
    .requiredOption("-c, --cluster <network>", "solana cluster to use")
    .requiredOption(
      "-w, --wallet <filepath>",
      'path to the operations key or "ledger"'
    )
    .requiredOption("-v, --vault <pubkey>", "multisig address")
    .option(
      "-lda, --ledger-derivation-account <number>",
      "ledger derivation account to use"
    )
    .option(
      "-ldc, --ledger-derivation-change <number>",
      "ledger derivation change to use"
    );

program
  .name("xc_admin_cli")
  .description("CLI for interacting with Pyth's xc_admin")
  .version("0.1.0");

multisigCommand(
  "accept-authority",
  "Accept authority from the program authority escrow"
)
  .requiredOption(
    "-p, --program-id <pubkey>",
    "program whose authority we want to transfer"
  )
  .requiredOption(
    "-a, --current <pubkey>",
    "current authority (before the transfer)"
  )

  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );
    const cluster: PythCluster = options.cluster;
    const programId: PublicKey = new PublicKey(options.programId);
    const current: PublicKey = new PublicKey(options.current);
    const vault: PublicKey = new PublicKey(options.vault);

    const isRemote = isRemoteCluster(cluster);
    const squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(getMultisigCluster(cluster)),
      wallet
    );
    const msAccount = await squad.getMultisig(vault);
    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    const programAuthorityEscrowIdl = await Program.fetchIdl(
      PROGRAM_AUTHORITY_ESCROW,
      new AnchorProvider(
        squad.connection,
        squad.wallet,
        AnchorProvider.defaultOptions()
      )
    );

    const programAuthorityEscrow = new Program(
      programAuthorityEscrowIdl!,
      PROGRAM_AUTHORITY_ESCROW,
      new AnchorProvider(
        squad.connection,
        squad.wallet,
        AnchorProvider.defaultOptions()
      )
    );
    const programDataAccount = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_UPGRADABLE_LOADER
    )[0];

    const proposalInstruction = await programAuthorityEscrow.methods
      .accept()
      .accounts({
        currentAuthority: current,
        newAuthority: isRemote ? mapKey(vaultAuthority) : vaultAuthority,
        programAccount: programId,
        programDataAccount,
        bpfUpgradableLoader: BPF_UPGRADABLE_LOADER,
      })
      .instruction();

    await proposeInstructions(
      squad,
      vault,
      [proposalInstruction],
      isRemote,
      WORMHOLE_ADDRESS[getMultisigCluster(cluster)]
    );
  });

multisigCommand("upgrade-program", "Upgrade a program from a buffer")
  .requiredOption(
    "-p, --program-id <pubkey>",
    "program that you want to upgrade"
  )
  .requiredOption("-b, --buffer <pubkey>", "buffer account")

  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );
    const cluster: PythCluster = options.cluster;
    const programId: PublicKey = new PublicKey(options.programId);
    const buffer: PublicKey = new PublicKey(options.buffer);
    const vault: PublicKey = new PublicKey(options.vault);

    const isRemote = isRemoteCluster(cluster);
    const squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(getMultisigCluster(cluster)),
      wallet
    );
    const msAccount = await squad.getMultisig(vault);
    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    const programDataAccount = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_UPGRADABLE_LOADER
    )[0];

    // This is intruction is not in @solana/web3.js, source : https://docs.rs/solana-program/latest/src/solana_program/bpf_loader_upgradeable.rs.html#200
    const proposalInstruction: TransactionInstruction = {
      programId: BPF_UPGRADABLE_LOADER,
      // 4-bytes instruction discriminator, got it from https://docs.rs/solana-program/latest/src/solana_program/loader_upgradeable_instruction.rs.html#104
      data: Buffer.from([3, 0, 0, 0]),
      keys: [
        { pubkey: programDataAccount, isSigner: false, isWritable: true },
        { pubkey: programId, isSigner: false, isWritable: true },
        { pubkey: buffer, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        {
          pubkey: isRemote ? mapKey(vaultAuthority) : vaultAuthority,
          isSigner: true,
          isWritable: false,
        },
      ],
    };

    await proposeInstructions(
      squad,
      vault,
      [proposalInstruction],
      isRemote,
      WORMHOLE_ADDRESS[getMultisigCluster(cluster)]
    );
  });

multisigCommand(
  "init-price",
  "Init price (useful for changing the exponent), only to be used on unused price feeds"
)
  .requiredOption("-p, --price <pubkey>", "Price account to modify")
  .requiredOption("-e, --exponent <number>", "New exponent")
  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );
    const cluster: PythCluster = options.cluster;
    const vault: PublicKey = new PublicKey(options.vault);
    const priceAccount: PublicKey = new PublicKey(options.price);
    const exponent = options.exponent;
    const squad = SquadsMesh.endpoint(getPythClusterApiUrl(cluster), wallet);

    const msAccount = await squad.getMultisig(vault);
    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    const provider = new AnchorProvider(
      squad.connection,
      wallet,
      AnchorProvider.defaultOptions()
    );
    const proposalInstruction: TransactionInstruction = await pythOracleProgram(
      getPythProgramKeyForCluster(cluster),
      provider
    )
      .methods.initPrice(exponent, 1)
      .accounts({ fundingAccount: vaultAuthority, priceAccount })
      .instruction();
    await proposeInstructions(squad, vault, [proposalInstruction], false);
  });

program
  .command("parse-transaction")
  .description("Parse a transaction sitting in the multisig")
  .requiredOption("-c, --cluster <network>", "solana cluster to use")
  .requiredOption(
    "-t, --transaction <pubkey>",
    "address of the outstanding transaction"
  )
  .action(async (options: any) => {
    const cluster = options.cluster;
    const transaction: PublicKey = new PublicKey(options.transaction);
    const squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(cluster),
      new NodeWallet(new Keypair())
    );
    const onChainInstructions = await getProposalInstructions(
      squad,
      await squad.getTransaction(new PublicKey(transaction))
    );
    const parser = MultisigParser.fromCluster(cluster);
    const parsed = onChainInstructions.map((ix) =>
      parser.parseInstruction({
        programId: ix.programId,
        data: ix.data as Buffer,
        keys: ix.keys as AccountMeta[],
      })
    );
    console.log(JSON.stringify(parsed, null, 2));
  });

multisigCommand("approve", "Approve a transaction sitting in the multisig")
  .requiredOption(
    "-t, --transaction <pubkey>",
    "address of the outstanding transaction"
  )
  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );
    const transaction: PublicKey = new PublicKey(options.transaction);
    const cluster: PythCluster = options.cluster;

    const squad = SquadsMesh.endpoint(getPythClusterApiUrl(cluster), wallet);
    await squad.approveTransaction(transaction);
  });

multisigCommand("propose-token-transfer", "Propose token transfer")
  .requiredOption("-a, --amount <number>", "amount in dollars")
  .requiredOption("-d, --destination <pubkey>", "destination address")
  .option(
    "-m --mint <pubkey>",
    "mint to transfer",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // default value is solana mainnet USDC SPL
  )
  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );

    const cluster: PythCluster = options.cluster;
    const destination: PublicKey = new PublicKey(options.destination);
    const mint: PublicKey = new PublicKey(options.mint);
    const vault: PublicKey = new PublicKey(options.vault);
    const amount: number = options.amount;

    const squad = SquadsMesh.endpoint(getPythClusterApiUrl(cluster), wallet);
    const msAccount = await squad.getMultisig(vault);
    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    const mintAccount = await getMint(
      squad.connection,
      mint,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mint,
      vaultAuthority,
      true
    );
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mint,
      destination
    );

    const proposalInstruction: TransactionInstruction =
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        vaultAuthority,
        BigInt(amount) * BigInt(10) ** BigInt(mintAccount.decimals)
      );

    await proposeInstructions(squad, vault, [proposalInstruction], false);
  });

multisigCommand("propose-sol-transfer", "Propose sol transfer")
  .requiredOption("-a, --amount <number>", "amount in sol")
  .requiredOption("-d, --destination <pubkey>", "destination address")
  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );

    const cluster: PythCluster = options.cluster;
    const isRemote = isRemoteCluster(cluster);
    const destination: PublicKey = new PublicKey(options.destination);
    const vault: PublicKey = new PublicKey(options.vault);
    const amount: number = options.amount;

    const squad = SquadsMesh.endpoint(
      getPythClusterApiUrl(getMultisigCluster(cluster)),
      wallet
    );
    const msAccount = await squad.getMultisig(vault);
    const vaultAuthority = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    const proposalInstruction: TransactionInstruction = SystemProgram.transfer({
      fromPubkey: isRemote ? mapKey(vaultAuthority) : vaultAuthority,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    });

    await proposeInstructions(
      squad,
      vault,
      [proposalInstruction],
      isRemote,
      WORMHOLE_ADDRESS[getMultisigCluster(cluster)]
    );
  });

/**
 * Activate proposal, mostly useful for cleaning up draft proposals that happen when the browser wallet fails to send all transactions succesfully
 */
multisigCommand("activate", "Activate a transaction sitting in the multisig")
  .requiredOption(
    "-t, --transaction <pubkey>",
    "address of the draft transaction"
  )
  .action(async (options: any) => {
    const wallet = await loadHotWalletOrLedger(
      options.wallet,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange
    );

    const transaction: PublicKey = new PublicKey(options.transaction);
    const cluster: PythCluster = options.cluster;

    const squad = SquadsMesh.endpoint(getPythClusterApiUrl(cluster), wallet);
    await squad.activateTransaction(transaction);
  });

program.parse();
