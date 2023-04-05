import { setDefaultWasm } from "@certusone/wormhole-sdk";
import { PublicKey } from "@solana/web3.js";
import { DEFAULT_MULTISIG_PROGRAM_ID, getMsPDA } from "@sqds/mesh";
import { program } from "commander";
import {
  getActiveProposals,
  getManyProposalsInstructions,
  getProposalInstructions,
} from "./multisig";
import { loadWormholeTools } from "./wormhole";
import {
  Cluster,
  getSquadsClient,
  CONFIG,
  hasWormholePayload,
  createWormholeMsgMultisigTx,
  loadInstructionsFromJson,
  areEqualOnChainInstructions,
  createTx,
  addInstructionsToTx,
  setIsActiveIx,
  executeMultisigTx,
  changeThreshold,
  addMember,
  removeMember,
  SquadInstruction,
} from "./helper";

setDefaultWasm("node");

// NOTE(2023-04-05): Donot export from this file:
// If any other file import anything from this file, commandline specific
// code will also be triggered.
// We don't want. Anything you would like to export should be added to an
// another file and not this.

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
    const cluster: Cluster = options.cluster;
    const createKeyAddr: PublicKey = new PublicKey(options.createKey);
    const extAuthorityAddr: PublicKey = new PublicKey(
      options.externalAuthority
    );

    const threshold: number = parseInt(options.threshold, 10);

    const initialMembers = options.initialMembers
      .split(",")
      .map((m: string) => new PublicKey(m));

    const mesh = await getSquadsClient(
      cluster,
      options.ledger,
      options.ledgerDerivationAccount,
      options.ledgerDerivationChange,
      options.payer,
      cluster == "localdevnet" ? options.solanaRpc : undefined
    );

    const vaultAddr = getMsPDA(createKeyAddr, DEFAULT_MULTISIG_PROGRAM_ID)[0];
    console.log("Creating new vault at", vaultAddr.toString());

    try {
      await mesh.getMultisig(vaultAddr);

      // NOTE(2022-12-08): If this check prevents you from iterating dev
      // work in tilt, restart solana-devnet.
      console.log(
        "Reached an existing vault under the address, refusing to create."
      );
      process.exit(17); // EEXIST
    } catch (e: any) {
      undefined;
    }
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
  .option("-f, --file <filepath>", "Path to a json file with instructions")
  .option("-p, --payload <hex-string>", "Wormhole VAA payload")
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

    if (options.payload && options.file) {
      console.log("Only one of --payload or --file must be provided");
      return;
    }

    if (options.payload) {
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
    }

    if (options.file) {
      const instructions: SquadInstruction[] = loadInstructionsFromJson(
        options.file
      );

      if (!options.skipDuplicateCheck) {
        const activeProposals = await getActiveProposals(
          squad,
          CONFIG[cluster].vault
        );
        const activeInstructions = await getManyProposalsInstructions(
          squad,
          activeProposals
        );

        for (let i = 0; i < activeProposals.length; i++) {
          if (
            areEqualOnChainInstructions(
              instructions.map((ix) => ix.instruction),
              activeInstructions[i]
            )
          ) {
            console.log(
              `❌ Skipping, instructions from ${options.file} match instructions at ${activeProposals[i].publicKey}`
            );
            return;
          }
        }
      }

      const txKey = await createTx(squad, CONFIG[cluster].vault);
      await addInstructionsToTx(
        cluster,
        squad,
        CONFIG[cluster].vault,
        txKey,
        instructions
      );
    }
  });

program
  .command("verify")
  .description("Verify given proposal matches a payload")
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
  .option("-p, --payload <hex-string>", "expected wormhole payload")
  .option("-f, --file <filepath>", "Path to a json file with instructions")
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

    if (options.payload && options.file) {
      console.log("Only one of --payload or --file must be provided");
      return;
    }

    const wormholeTools = await loadWormholeTools(cluster, squad.connection);

    const onChainInstructions = await getProposalInstructions(
      squad,
      await squad.getTransaction(new PublicKey(options.txPda))
    );

    const msAccount = await squad.getMultisig(CONFIG[cluster].vault);
    const emitter = squad.getAuthorityPDA(
      msAccount.publicKey,
      msAccount.authorityIndex
    );

    if (options.payload) {
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
    }

    if (options.file) {
      const instructions: SquadInstruction[] = loadInstructionsFromJson(
        options.file
      );

      if (
        areEqualOnChainInstructions(
          instructions.map((ix) => ix.instruction),
          onChainInstructions
        )
      ) {
        console.log(
          "✅ This proposal is verified to be created with the given instructions."
        );
      } else {
        console.log("❌ This proposal does not match the given instructions.");
      }
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
