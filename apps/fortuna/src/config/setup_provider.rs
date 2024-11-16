use {crate::config::ConfigOptions, clap::Args};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Setup Provider Options")]
#[group(id = "SetupProviderOptions")]
pub struct SetupProviderOptions {
    #[command(flatten)]
    pub config: ConfigOptions,
}
