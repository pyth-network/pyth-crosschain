use {
    clap::Args,
    solana_sdk::pubkey::Pubkey,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Pyth Addresses Options")]
#[group(id = "Pyth Addresses")]
pub struct Options {
    /// Pyth mapping address.
    #[arg(long = "mapping-address")]
    #[arg(env = "MAPPING_ADDRESS")]
    pub mapping: Option<Pubkey>,
}
