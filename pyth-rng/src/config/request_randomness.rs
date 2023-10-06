use clap::Args;

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Request Randomness Options")]
#[group(id = "RequestRandomness")]
pub struct RequestRandomnessOptions {
    /// Private Key of a wallet used to pay for the request transactions.
    #[arg(long = "request-payer-key")]
    #[arg(env = "REQUEST_PAYER_KEY")]
    pub key: String,

    /// A provider public key to request randomness from.
    #[arg(long = "request-provider-key")]
    #[arg(env = "REQUEST_PROVIDER_KEY")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub addr: String,

    /// Address of a Pyth Randomness Service contract to request from.
    #[arg(long = "pyth-contract-addr")]
    #[arg(env = "PYTH_CONTRACT_ADDR")]
    #[arg(default_value = "0x604DB585A852f61bB42D7bD28F3595cBC86C5b6E")]
    pub contract_addr: String,

    /// A secret used for generating new hash chains. A 64-char hex string.
    #[arg(long = "request-secret")]
    #[arg(env = "PYTH_SECRET")]
    pub secret: String,
}
