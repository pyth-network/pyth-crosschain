use clap::Args;

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Get Request Options")]
#[group(id = "GetRequest")]
pub struct GetRequestOptions {
    /// A 20-byte (40 char) hex encoded Ethereum private key used to register a new provider.
    ///
    /// The wallet provided will be charged the registration cost, and the new provider will be
    /// registered at the address associated with this private key.
    #[arg(long = "provider-key")]
    #[arg(env = "REGISTER_PROVIDER_KEY")]
    pub provider_key: String,

    /// URL of a Geth RPC endpoint to use for registering the provider.
    #[arg(long = "geth-rpc-addr")]
    #[arg(env = "GETH_RPC_ADDR")]
    #[arg(default_value = "https://goerli.optimism.io")]
    pub geth_rpc_addr: String,

    /// Address of a Pyth Randomness Service contract to use for registering the provider.
    #[arg(long = "pyth-contract-addr")]
    #[arg(env = "PYTH_CONTRACT_ADDR")]
    #[arg(default_value = "0x604DB585A852f61bB42D7bD28F3595cBC86C5b6E")]
    pub contract_addr: String,

    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: String,

    /// A secret used for generating new hash chains. A 64-char hex string.
    #[arg(long = "sequence")]
    #[arg(env = "PYTH_SEQUENCE")]
    #[arg(default_value = "0")]
    pub sequence: u64,
}
