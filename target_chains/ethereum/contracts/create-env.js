/**
 * This script is used to generate the .env file for a specific network.
 * You can call it like this:
 *  node create-env.js <contract-id>
 */

const { DefaultStore, EvmChain } = require("contract_manager");
const { writeFileSync } = require("fs");

async function main() {
  const chainId = process.argv[2];
  const chain = DefaultStore.chains[chainId];
  if (!chain) {
    throw new Error(`Chain ${chainId} not found`);
  }
  if (!(chain instanceof EvmChain)) {
    throw new Error(`${chainId} is not an EVM chain`);
  }
  writeFileSync(
    `.env`,
    `MIGRATIONS_DIR=./migrations/prod-receiver\n` +
      `MIGRATIONS_NETWORK=${chain.getId()}\n` +
      `WORMHOLE_CHAIN_NAME=${chain.wormholeChainName}\n` +
      `NETWORK_ID=${chain.networkId}\n` +
      `RPC_URL=${chain.getRpcUrl()}\n`
  );
}

main();
