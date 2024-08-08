import { Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { pythOracleProgram } from "@pythnetwork/client";
import {
  PythCluster,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import {
  AccountMeta,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import SquadsMesh from "@sqds/mesh";
import { program } from "commander";
import fs from "fs";
import {
  BPF_UPGRADABLE_LOADER,
  MultisigParser,
  MultisigVault,
  PROGRAM_AUTHORITY_ESCROW,
  getMultisigCluster,
  getProposalInstructions,
  findDetermisticStakeAccountAddress,
} from "@pythnetwork/xc-admin-common";

import {
  pythSolanaReceiverIdl,
  getConfigPda,
  DEFAULT_RECEIVER_PROGRAM_ID,
} from "@pythnetwork/pyth-solana-receiver";

import { LedgerNodeWallet } from "./ledger";
import { DEFAULT_PRIORITY_FEE_CONFIG } from "@pythnetwork/solana-utils";

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

async function loadVaultFromOptions(options: any): Promise<MultisigVault> {
  const wallet = await loadHotWalletOrLedger(
    options.wallet,
    options.ledgerDerivationAccount,
    options.ledgerDerivationChange
  );
  // This is the cluster where we want to perform the action
  const cluster: PythCluster = options.cluster;
  // This is the cluster where the multisig lives that can perform actions on ^
  const multisigCluster = getMultisigCluster(cluster);
  const vault: PublicKey = new PublicKey(options.vault);

  const squad = SquadsMesh.endpoint(
    options.rpcUrlOverride ?? getPythClusterApiUrl(multisigCluster),
    wallet
  );

  return new MultisigVault(wallet, multisigCluster, squad, vault);
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
    .requiredOption(
      "-v, --vault <pubkey>",
      "multisig address, all the addresses can be found in xc_admin_common/src/multisig.ts"
    )
    .option(
      "-lda, --ledger-derivation-account <number>",
      "ledger derivation account to use"
    )
    .option(
      "-ldc, --ledger-derivation-change <number>",
      "ledger derivation change to use"
    )
    .option(
      "-u, --rpc-url-override <string>",
      "RPC URL to override the default for the cluster. Make sure this is an RPC URL of the cluster where the multisig lives. For Pythnet proposals it should be a Solana Mainnet RPC URL."
    );

program
  .name("xc_admin_cli")
  .description("CLI for interacting with Pyth's xc_admin")
  .version("0.1.0");

multisigCommand(
  "escrow-program-accept-authority",
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
    const vault = await loadVaultFromOptions(options);
    const targetCluster: PythCluster = options.cluster;

    const programId: PublicKey = new PublicKey(options.programId);
    const current: PublicKey = new PublicKey(options.current);

    const programAuthorityEscrowIdl = await Program.fetchIdl(
      PROGRAM_AUTHORITY_ESCROW,
      vault.getAnchorProvider()
    );

    const programAuthorityEscrow = new Program(
      programAuthorityEscrowIdl!,
      PROGRAM_AUTHORITY_ESCROW,
      vault.getAnchorProvider()
    );
    const programDataAccount = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_UPGRADABLE_LOADER
    )[0];

    const proposalInstruction = await programAuthorityEscrow.methods
      .accept()
      .accounts({
        currentAuthority: current,
        newAuthority: await vault.getVaultAuthorityPDA(targetCluster),
        programAccount: programId,
        programDataAccount,
        bpfUpgradableLoader: BPF_UPGRADABLE_LOADER,
      })
      .instruction();

    await vault.proposeInstructions(
      [proposalInstruction],
      targetCluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand(
  "solana-receiver-program-accept-governance-authority-transfer",
  "Accept governance authority transfer for the solana receiver program"
).action(async (options: any) => {
  const vault = await loadVaultFromOptions(options);
  const targetCluster: PythCluster = options.cluster;

  const programSolanaReceiver = new Program(
    pythSolanaReceiverIdl,
    DEFAULT_RECEIVER_PROGRAM_ID,
    vault.getAnchorProvider()
  );

  const proposalInstruction = await programSolanaReceiver.methods
    .acceptGovernanceAuthorityTransfer()
    .accounts({
      payer: await vault.getVaultAuthorityPDA(targetCluster),
      config: getConfigPda(DEFAULT_RECEIVER_PROGRAM_ID),
    })
    .instruction();

  await vault.proposeInstructions(
    [proposalInstruction],
    targetCluster,
    DEFAULT_PRIORITY_FEE_CONFIG
  );
});

multisigCommand(
  "solana-receiver-program-request-governance-authority-transfer",
  "Request governance authority transfer for the solana receiver program"
)
  .requiredOption(
    "-t, --target <pubkey>",
    "The new governance authority to take over. " +
      "If the target is another multisig, it will be the multisig's vault authority PDA."
  )
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const targetCluster: PythCluster = options.cluster;
    const target: PublicKey = new PublicKey(options.target);

    const programSolanaReceiver = new Program(
      pythSolanaReceiverIdl,
      DEFAULT_RECEIVER_PROGRAM_ID,
      vault.getAnchorProvider()
    );

    const proposalInstruction = await programSolanaReceiver.methods
      .requestGovernanceAuthorityTransfer(target)
      .accounts({
        payer: await vault.getVaultAuthorityPDA(targetCluster),
        config: getConfigPda(DEFAULT_RECEIVER_PROGRAM_ID),
      })
      .instruction();

    await vault.proposeInstructions(
      [proposalInstruction],
      targetCluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand("upgrade-program", "Upgrade a program from a buffer")
  .requiredOption(
    "-p, --program-id <pubkey>",
    "program that you want to upgrade"
  )
  .requiredOption("-b, --buffer <pubkey>", "buffer account")

  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const cluster: PythCluster = options.cluster;
    const programId: PublicKey = new PublicKey(options.programId);
    const buffer: PublicKey = new PublicKey(options.buffer);

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
        { pubkey: vault.wallet.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        {
          pubkey: await vault.getVaultAuthorityPDA(cluster),
          isSigner: true,
          isWritable: false,
        },
      ],
    };

    await vault.proposeInstructions(
      [proposalInstruction],
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

async function closeProgramOrBuffer(
  vault: MultisigVault,
  cluster: PythCluster,
  programDataOrBufferAccount: PublicKey,
  spill: PublicKey,
  programId?: PublicKey
) {
  let accounts = [
    { pubkey: programDataOrBufferAccount, isSigner: false, isWritable: true },
    { pubkey: spill, isSigner: false, isWritable: true },
    {
      pubkey: await vault.getVaultAuthorityPDA(cluster),
      isSigner: true,
      isWritable: false,
    },
  ];
  if (programId) {
    accounts.push({ pubkey: programId, isSigner: false, isWritable: true });
  }

  const proposalInstruction: TransactionInstruction = {
    programId: BPF_UPGRADABLE_LOADER,
    // 4-bytes instruction discriminator, got it from https://docs.rs/solana-program/latest/src/solana_program/loader_upgradeable_instruction.rs.html
    data: Buffer.from([5, 0, 0, 0]),
    keys: accounts,
  };

  await vault.proposeInstructions(
    [proposalInstruction],
    cluster,
    DEFAULT_PRIORITY_FEE_CONFIG
  );
}

multisigCommand(
  "close-program",
  "Close a program, retrieve the funds. WARNING : THIS WILL BRICK THE PROGRAM AND THE ACCOUNTS IT OWNS FOREVER"
)
  .requiredOption("-p, --program-id <pubkey>", "program that you want to close")
  .requiredOption("-s, --spill <pubkey>", "address to receive the funds")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const spill = new PublicKey(options.spill);
    const cluster: PythCluster = options.cluster;
    const programId: PublicKey = new PublicKey(options.programId);

    const programDataAccount = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_UPGRADABLE_LOADER
    )[0];

    await closeProgramOrBuffer(
      vault,
      cluster,
      programDataAccount,
      spill,
      programId
    );
  });

multisigCommand("close-buffer", "Close a buffer, retrieve the funds.")
  .requiredOption("-b, --buffer <pubkey>", "buffer that you want to close")
  .requiredOption("-s, --spill <pubkey>", "address to receive the funds")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const spill = new PublicKey(options.spill);
    const cluster: PythCluster = options.cluster;
    const bufferAccount = new PublicKey(options.buffer);

    await closeProgramOrBuffer(vault, cluster, bufferAccount, spill);
  });

multisigCommand(
  "deactivate-stake",
  "Deactivate the delegated stake from the account"
)
  .requiredOption(
    "-s, --stake-accounts <accounts...>",
    "stake accounts to be deactivated"
  )
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const cluster: PythCluster = options.cluster;
    const authorizedPubkey: PublicKey = await vault.getVaultAuthorityPDA(
      cluster
    );
    const instructions = options.stakeAccounts.reduce(
      (instructions: TransactionInstruction[], stakeAccount: string) => {
        const transaction = StakeProgram.deactivate({
          stakePubkey: new PublicKey(stakeAccount),
          authorizedPubkey,
        });

        return instructions.concat(transaction.instructions);
      },
      []
    );

    await vault.proposeInstructions(
      instructions,
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand(
  "delegate-stake",
  "Delegate a stake account to the given vote account"
)
  .requiredOption("-s, --stake-account <pubkey>", "stake account to delegate")
  .requiredOption("-d, --vote-account <pubkey>", "vote account to delegate to")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const cluster: PythCluster = options.cluster;
    const authorizedPubkey: PublicKey = await vault.getVaultAuthorityPDA(
      cluster
    );

    const stakeAccount: PublicKey = new PublicKey(options.stakeAccount);
    const voteAccount: PublicKey = new PublicKey(options.voteAccount);

    const instructions = StakeProgram.delegate({
      stakePubkey: stakeAccount,
      authorizedPubkey,
      votePubkey: voteAccount,
    }).instructions;

    await vault.proposeInstructions(
      instructions,
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand(
  "initialize-stake-accounts",
  "Initialize stake accounts and assign them to the given vote accounts"
)
  .requiredOption(
    "-d, --vote-pubkeys <comma_separated_voter_pubkeys>",
    "vote account to delegate to"
  )
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const cluster: PythCluster = options.cluster;
    const authorizedPubkey: PublicKey = await vault.getVaultAuthorityPDA(
      cluster
    );

    const votePubkeys: PublicKey[] = options.votePubkeys
      ? options.votePubkeys.split(",").map((m: string) => new PublicKey(m))
      : [];

    const instructions: TransactionInstruction[] = [];

    for (const votePubkey of votePubkeys) {
      const [stakePubkey, seed] = await findDetermisticStakeAccountAddress(
        authorizedPubkey,
        votePubkey
      );
      instructions.push(
        SystemProgram.createAccountWithSeed({
          basePubkey: authorizedPubkey,
          seed: seed,
          fromPubkey: authorizedPubkey,
          newAccountPubkey: stakePubkey,
          lamports: 100000 * LAMPORTS_PER_SOL,
          space: StakeProgram.space,
          programId: StakeProgram.programId,
        })
      );
      instructions.push(
        StakeProgram.initialize({
          stakePubkey,
          authorized: {
            staker: authorizedPubkey,
            withdrawer: authorizedPubkey,
          },
        })
      );
      instructions.push(
        StakeProgram.delegate({
          stakePubkey,
          authorizedPubkey,
          votePubkey,
        }).instructions[0]
      );
    }

    await vault.proposeInstructions(
      instructions,
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand(
  "init-price",
  "Init price (useful for changing the exponent), only to be used on unused price feeds"
)
  .requiredOption("-p, --price <pubkey>", "Price account to modify")
  .requiredOption("-e, --exponent <number>", "New exponent")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const cluster: PythCluster = options.cluster;
    const priceAccount: PublicKey = new PublicKey(options.price);
    const exponent = options.exponent;

    const proposalInstruction: TransactionInstruction = await pythOracleProgram(
      getPythProgramKeyForCluster(cluster),
      vault.getAnchorProvider()
    )
      .methods.setExponent(exponent, 1)
      .accounts({
        fundingAccount: await vault.getVaultAuthorityPDA(cluster),
        priceAccount,
      })
      .instruction();
    await vault.proposeInstructions(
      [proposalInstruction],
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
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
    console.log(
      JSON.stringify(
        parsed,
        (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
        2
      )
    );
  });

multisigCommand("approve", "Approve a transaction sitting in the multisig")
  .requiredOption(
    "-t, --transaction <pubkey>",
    "address of the outstanding transaction"
  )
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);
    const transaction: PublicKey = new PublicKey(options.transaction);
    await vault.squad.approveTransaction(transaction);
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
    const vault = await loadVaultFromOptions(options);

    const cluster: PythCluster = options.cluster;
    const connection = new Connection(getPythClusterApiUrl(cluster)); // from cluster
    const destination: PublicKey = new PublicKey(options.destination);
    const mint: PublicKey = new PublicKey(options.mint);
    const amount: number = options.amount;

    const mintAccount = await getMint(
      connection,
      mint,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mint,
      await vault.getVaultAuthorityPDA(cluster),
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
        await vault.getVaultAuthorityPDA(cluster),
        BigInt(amount) * BigInt(10) ** BigInt(mintAccount.decimals)
      );

    await vault.proposeInstructions(
      [proposalInstruction],
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand("propose-sol-transfer", "Propose sol transfer")
  .requiredOption("-a, --amount <number>", "amount in sol")
  .requiredOption("-d, --destination <pubkey>", "destination address")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);

    const cluster: PythCluster = options.cluster;
    const destination: PublicKey = new PublicKey(options.destination);
    const amount: number = options.amount;

    const proposalInstruction: TransactionInstruction = SystemProgram.transfer({
      fromPubkey: await vault.getVaultAuthorityPDA(cluster),
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    });

    await vault.proposeInstructions(
      [proposalInstruction],
      cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

multisigCommand("propose-arbitrary-payload", "Propose arbitrary payload")
  .option("-p, --payload <hex-string>", "Wormhole VAA payload")
  .action(async (options: any) => {
    const vault = await loadVaultFromOptions(options);

    let payload = options.payload;
    if (payload.startsWith("0x")) {
      payload = payload.substring(2);
    }

    await vault.proposeWormholeMessage(Buffer.from(payload, "hex"));
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
    const vault = await loadVaultFromOptions(options);
    const transaction: PublicKey = new PublicKey(options.transaction);
    await vault.squad.activateTransaction(transaction);
  });

multisigCommand("add-and-delete", "Change the roster of the multisig")
  .option(
    "-a, --add <comma_separated_members>",
    "addresses to add to the multisig"
  )
  .option(
    "-r, --remove <comma_separated_members>",
    "addresses to remove from the multisig"
  )
  .requiredOption(
    "-t, --target-vaults <comma_separated_vaults>",
    "the vault whose roster we want to change"
  )
  .action(async (options: any) => {
    const vault: MultisigVault = await loadVaultFromOptions(options);

    const targetVaults: PublicKey[] = options.targetVaults
      ? options.targetVaults.split(",").map((m: string) => new PublicKey(m))
      : [];

    let proposalInstructions: TransactionInstruction[] = [];

    const membersToAdd: PublicKey[] = options.add
      ? options.add.split(",").map((m: string) => new PublicKey(m))
      : [];

    for (const member of membersToAdd) {
      for (const targetVault of targetVaults) {
        proposalInstructions.push(await vault.addMemberIx(member, targetVault));
      }
    }

    const membersToRemove: PublicKey[] = options.remove
      ? options.remove.split(",").map((m: string) => new PublicKey(m))
      : [];

    for (const member of membersToRemove) {
      for (const targetVault of targetVaults) {
        proposalInstructions.push(
          await vault.removeMemberIx(member, targetVault)
        );
      }
    }

    vault.proposeInstructions(
      proposalInstructions,
      options.cluster,
      DEFAULT_PRIORITY_FEE_CONFIG
    );
  });

/**
 * READ THIS BEFORE USING THIS COMMAND
 * This command exists because of a bug in mesh where
 * roster change proposals executed through executeInstruction don't work.
 * It is equivalent to executing proposals through the mesh UI.
 * It might not work for some types of proposals that require the crank to
 * execute them.
 * https://github.com/Squads-Protocol/squads-mpl/pull/32
 */
multisigCommand("execute-add-and-delete", "Execute a roster change proposal")
  .requiredOption("-t, --transaction <pubkey>", "address of the proposal")
  .action(async (options: any) => {
    const vault: MultisigVault = await loadVaultFromOptions(options);
    const proposal = new PublicKey(options.transaction);
    await vault.squad.executeTransaction(proposal);
  });

program.parse();
