/**
 * This script is used to generate the .env file for a specific network.
 * You can call it like this:
 *  node create-env.js <contract-id>
 */

const { DefaultStore, EvmContract } = require("contract_manager");

async function main() {
  const contractId = process.argv[2];
  const contract = DefaultStore.contracts[contractId];
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }
  if (!(contract instanceof EvmContract)) {
    throw new Error(`${contractId} is not an EVM contract`);
  }
  const migrationDir = (await (
    await contract.getWormholeContract()
  ).isWormholeReceiver())
    ? "prod-receiver"
    : "prod";
  const cluster = contract.getChain().isMainnet() ? "mainnet" : "testnet";
  console.log(
    `MIGRATIONS_DIR=./migrations/${migrationDir}\n` +
      `MIGRATIONS_NETWORK=${contract.getChain().getId()}\n` +
      `WORMHOLE_CHAIN_NAME=${contract.getChain().wormholeChainName}\n` +
      `CLUSTER=${cluster}\n` +
      `NETWORK_ID=${contract.getChain().networkId}\n` +
      `RPC_URL=${contract.getChain().getRpcUrl()}\n` +
      `VALID_TIME_PERIOD_SECONDS=${await contract.getValidTimePeriod()}`
  );
}

main();
