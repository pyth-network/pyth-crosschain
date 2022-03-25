# Deploying Contracts to Production

Running the Truffle migrations in [`migrations/prod`](migrations/prod) will deploy the contracts to production. Truffle stores the address of the deployed contracts in the build artifacts, which can make local development difficult. We use [`truffle-deploy-registry`](https://github.com/MedXProtocol/truffle-deploy-registry) to store the addresses separately from the artifacts, in the [`networks`](networks) directory. When we need to perform operations on the deployed contracts, such as performing additional migrations, we can run `apply-registry -n networks/$NETWORK` to populate the artifacts with the correct addresses.

An example deployment process, for deploying to Binance Smart Chain Testnet:

```bash
# Load the configuration environment variables for deploying to BSC Testnet.
rm -f .env && ln -s .env.prod.binance_testnet .env & set -o allexport && source .env set && set +o allexport

# The Secret Recovery Phrase for the wallet the contract will be deployed from.
export MNEMONIC=...

# Ensure that we deploy a fresh build with up-to-date dependencies.
rm -rf build .openzeppelin node_modules && npm install && npx truffle compile --all

# Merge the network addresses into the artifacts, if some contracts are already deployed.
npx apply-registry -n networks/$MIGRATIONS_NETWORK

# Perform the migration
npx truffle migrate --network $MIGRATIONS_NETWORK

# Running the migration will cause a JSON file to be written to the networks/
# directory, with a filename like 1648198934288.json (the Truffle network ID).
# To make it more obvious which network this corresponds to, move this file
# to networks/$MIGRATIONS_NETWORK.
mkdir -p networks/$MIGRATIONS_NETWORK && mv networks/NETWORK__ID.json networks/$MIGRATIONS_NETWORK
```

As a sanity check, it is recommended to deploy the  migrations in `migrations/prod` to the Truffle `development` network first. You can do this by using the configuration values in [`.env.prod.development`](.env.prod.development).
