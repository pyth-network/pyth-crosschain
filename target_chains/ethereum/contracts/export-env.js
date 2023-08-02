const { DefaultStore } = require("contract_manager");

async function main() {
  const contractId = process.argv[2];
  const contract = DefaultStore.contracts[contractId];
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }
}

main();
