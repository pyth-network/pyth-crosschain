# Fortuna

Fortuna is a webservice that serves random numbers according to the Entropy protocol.
The webservice generates a hash chain of random numbers and reveals them to callers when permitted by the protocol.
The hash chain is generated from a secret key that is provided to the server on startup.
The service also operates a keeper task that performs callback transactions for user requests.

A single instance of this service can simultaneously serve random numbers for several different blockchains.
Each blockchain is configured in `config.yaml`.

## Build & Test

Fortuna uses Cargo for building and dependency management.
Simply run `cargo build` and `cargo test` to build and test the project.
To run Fortuna locally, see the [Local Development](#local-development) section below.

### Connect a database
Fortuna stores request history in a SQL database and serves it from its explorer API.
Any SQLite or Postgres database is supported. The database connection is sourced from the `DATABASE_URL` env var.
Create a `.env` file in the root of the project with a DB connection string.
```
DATABASE_URL="sqlite:fortuna.db?mode=rwc"
```
If not provided, Fortuna will create and use a SQLite file-based database at `./fortuna.db`, as in the example above.

### Database migrations
Fortuna will automatically apply the schema migrations in the `./migrations` directory when connecting to the database.
To manually administer the migrations, use the `sqlx` tool for cargo. The tool automatically uses the
database connection in the `.env` file.

Install `sqlx`:
```bash
cargo install sqlx
```

To create the database if needed and apply the migrations:
```bash
cargo sqlx migrate run
```

To restore the database to a fresh state (drop, recreate, apply migrations):
```bash
cargo sqlx database reset
```

## Command-Line Interface

The Fortuna binary has a command-line interface to perform useful operations on the contract, such as
registering a new randomness provider, or drawing a random value. To see the available commands, simply run `cargo run`.

## Multiple Replica Setup

Fortuna supports running multiple replica instances for high availability and reliability. This prevents service interruption if one instance goes down and distributes the workload across multiple instances.

### How Replica Assignment Works

- Each replica is assigned a unique `replica_id` (0, 1, 2, etc.)
- Requests are distributed using modulo assignment: `sequence_number % total_replicas`
- Each replica primarily handles requests assigned to its ID
- After a configurable delay, replicas will process requests from other replicas as backup (failover)

### Fee Management with Multiple Instances

When running multiple Fortuna instances with different keeper wallets, the system uses a fair fee distribution strategy. Each keeper will withdraw fees from the contract to maintain a balanced distribution across all known keeper addresses and the fee manager address.

The fee manager (configured in the provider section) can be a separate wallet from the keeper wallets. When fees are withdrawn from the contract, they go to the fee manager wallet first, then are automatically transferred to the requesting keeper wallet.

**Key Configuration:**
- All instances should have `keeper.private_key` and `keeper.fee_manager_private_key` provided so that each keeper can top itself up as fee manager from contract fees.

### Example Configurations

```yaml
# Replica 0 - handles even sequence numbers + fee management
keeper:
  private_key:
    value: 0x<keeper_0_private_key>
  fee_manager_private_key:
    value: 0x<fee_manager_private_key>
  other_keeper_addresses:
    - 0x<keeper_0_address>  # This replica's address
    - 0x<keeper_1_address>  # Other replica's address
  replica_config:
    replica_id: 0
    total_replicas: 2
    backup_delay_seconds: 15


# Replica 1 - handles odd sequence numbers
keeper:
  private_key:
    value: 0x<keeper_1_private_key>
  fee_manager_private_key:
    value: 0x<fee_manager_private_key>
  other_keeper_addresses:
    - 0x<keeper_0_address>  # Other replica's address
    - 0x<keeper_1_address>  # This replica's address
  replica_config:
    replica_id: 1
    total_replicas: 2
    backup_delay_seconds: 15

```

### Deployment Considerations

1. **Separate Wallets**: Each replica MUST use a different private key to avoid nonce conflicts
2. **Fee Manager Assignment**: Set the provider's `fee_manager` address to match the primary instance's keeper wallet
3. **Thread Configuration**: Only enable fee management threads on the instance using the fee manager wallet
4. **Backup Delay**: Set `backup_delay_seconds` long enough to allow primary replica to process requests, but short enough for acceptable failover time (recommended: 10-30 seconds)
5. **Monitoring**: Monitor each replica's processing metrics to ensure proper load distribution
6. **Gas Management**: Each replica needs sufficient ETH balance for gas fees

### Failover Behavior

- Primary replica processes requests immediately
- Backup replicas wait for `backup_delay_seconds` before checking if request is still unfulfilled
- If request is already fulfilled during the delay, backup replica skips processing
- This prevents duplicate transactions and wasted gas while ensuring reliability

## Local Development

To start an instance of the webserver for local testing, you first need to perform a few setup steps:

1. Create a `config.yaml` file to point to the desired blockchains and Entropy contracts. Copy the content in `config.sample.yaml` and follow the directions inside to generate the necessary private keys and secrets.
1. Make sure the wallets you have generated in step (1) contain some gas tokens for the configured networks.
1. Run `cargo run -- setup-provider` to register a randomness provider for this service. This command
   will update the on-chain contracts such that the configured provider key is a randomness provider,
   and its on-chain configuration matches `config.yaml`.
1. Review the [Connect a database](#connect-a-database) section above. The default configuration will create a file-based DB.
Once you've completed the setup, simply run the following command to start the service:

```bash
RUST_LOG=INFO cargo run -- run
```

This command will start the webservice on `localhost:34000`.

## Nix

If you are a nix user, you can use the included [Nix flake](./flake.nix) and
[direnv config](./envrc) which will configure your environment for you
automatically.  If you use this configuration you will have a `cli` script in
your dev shell which provides easy access to some common tasks, such as `cli
start` to start the server in watch mode, `cli test` to run unit, code format,
and lint checks, and `cli fix` to run auto-fixes for formatting and lint issues.
