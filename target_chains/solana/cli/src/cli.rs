use {
    clap::{Parser, Subcommand},
    solana_sdk::pubkey::Pubkey,
    std::str::FromStr,
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the solana receiver contract",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(
        short = 'k',
        long,
        default_value = "~/.config/solana/id.json",
        help = "Keypair of the payer of transactions"
    )]
    pub keypair: String,
    #[clap(
        short = 'u',
        long,
        default_value = "http://localhost:8899",
        help = "RPC endpoint of the solana"
    )]
    pub url: String,
    #[clap(short = 'w', long, parse(try_from_str = Pubkey::from_str), help = "Address of the wormhole contract")]
    pub wormhole: Pubkey,
    #[clap(subcommand)]
    pub action: Action,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Post a price update from Hermes to Solana")]
    PostPriceUpdate {
        #[clap(short = 'p', long, help = "Payload from Hermes")]
        payload: String,
    },
    #[clap(about = "Post a price update from Hermes to Solana in one transaction")]
    PostPriceUpdateAtomic {
        #[clap(short = 'p', long, help = "Payload from Hermes")]
        payload: String,
        #[clap(
            short = 'n',
            default_value = "5",
            help = "Number of signatures to verify. If n >= 5 this will fail because of the transaction size limit."
        )]
        n_signatures: usize,
    },
    #[clap(about = "Post a TWAP update from Hermes to Solana")]
    PostTwapUpdate {
        #[clap(
            short = 's',
            long,
            help = "Start base64 data from Hermes (binary.data.0)"
        )]
        start_payload: String,
        #[clap(
            short = 'e',
            long,
            help = "End base64 data from Hermes (binary.data.1)"
        )]
        end_payload: String,
    },
    #[clap(
        about = "Initialize a wormhole receiver contract by sequentially replaying the guardian set updates"
    )]
    InitializeWormholeReceiver {},
    InitializePythReceiver {
        #[clap(short = 'f', long, help = "Fee in lamports")]
        fee: u64,
        #[clap(short = 'e', long, parse(try_from_str = Pubkey::from_str), help = "Source emitter")]
        emitter: Pubkey,
        #[clap(short = 'c', long, help = "Source chain")]
        chain: u16,
        #[clap(short = 'a', long, parse(try_from_str = Pubkey::from_str), help = "Governance authority")]
        governance_authority: Pubkey,
    },
}
