// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

// biome-ignore lint/style/noCommonJs: Anchor migrations require CommonJS format
const anchor = require("@project-serum/anchor");

// biome-ignore lint/style/noCommonJs: Anchor migrations require CommonJS format
// biome-ignore-all lint/suspicious/noExplicitAny: Anchor provider type is any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/style/noCommonJs: Anchor migrations require CommonJS format
module.exports = async (provider: any) => {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Add your deploy script here.
};
