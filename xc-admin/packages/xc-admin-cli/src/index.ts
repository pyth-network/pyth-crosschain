import { Keypair, PublicKey } from "@solana/web3.js";
import { program } from "commander";
import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { AnchorError, AnchorProvider, Program } from "@coral-xyz/anchor";
import fs from "fs";
import SquadsMesh from "@sqds/mesh";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { proposeInstructions } from "xc-admin-common";

const PROGRAM_AUTHORITY_ESCROW = new PublicKey(
  "escMHe7kSqPcDHx4HU44rAHhgdTLBZkUrU39aN8kMcL"
);
const BPF_UPGRADABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

const mutlisigCommand = (name: string, description: string) =>
  program
    .command(name)
    .description(description)
    .requiredOption("-c, --cluster <network>", "solana cluster to use")
    .requiredOption("-w, --wallet <filepath>", "path to the operations key")
    .requiredOption("-v, --vault <pubkey>", "multisig address");

program
  .name("xc-admin-cli")
  .description("CLI for interacting with Pyth's xc-admin")
  .version("0.1.0");

mutlisigCommand(
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
    const wallet = new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(options.wallet, "ascii")))
      )
    );
    const cluster: PythCluster = options.cluster;
    const programId: PublicKey = new PublicKey(options.programId);
    const current: PublicKey = new PublicKey(options.current);
    const vault: PublicKey = new PublicKey(options.vault);

    const squad = SquadsMesh.endpoint(getPythClusterApiUrl(cluster), wallet);
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
        newAuthority: vaultAuthority,
        programAccount: programId,
        programDataAccount,
        bpfUpgradableLoader: BPF_UPGRADABLE_LOADER,
      })
      .instruction();

    await proposeInstructions(squad, vault, [proposalInstruction], false);
  });

program.parse();
