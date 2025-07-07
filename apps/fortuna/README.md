# Fortuna

Fortuna is a webservice that serves random numbers according to the Entropy protocol.
The webservice generates a hash chain of random numbers and reveals them to callers when permitted by the protocol.
The hash chain is generated from a secret key that is provided to the server on startup.
The service also operates a keeper task that performs callback transactions for user requests.

A single instance of this service can simultaneously serve random numbers for several different blockchains.
Each blockchain is configured in `config.yaml`.

## Build & Test

We use sqlx query macros to check the SQL queries at compile time. This requires
a database to be available at build time. Create a `.env` file in the root of the project with the following content:

```
DATABASE_URL="sqlite:fortuna.db?mode=rwc"
```

Install sqlx for cargo with:
```bash
cargo install sqlx
```

Next, you need to create the database and apply the schema migrations. You can do this by running:

```bash
cargo sqlx migrate run # automatically picks up the .env file
```
This will create a SQLite database file called `fortuna.db` in the root of the project and apply the schema migrations to it.
This will allow `cargo check` to check the queries against the existing database.

Fortuna uses Cargo for building and dependency management.
Simply run `cargo build` and `cargo test` to build and test the project.

If you have changed any queries in the code, you need to update the .sqlx folder with the new queries:

```bash
cargo sqlx prepare
```
Please add the changed files in the `.sqlx` folder to your git commit.

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

When running multiple Fortuna instances with different keeper wallets but a single provider, only one instance should handle fee management. This instance needs to run using the same private key as the fee manager, because only the registerd fee manager wallet can adjust fees and withdraw funds.

### Example Configurations

**Two Replica Setup with Fee Management:**
```yaml
# Replica 0 (fee manager wallet) - handles even sequence numbers + fee management
keeper:
  private_key:
    value: 0x<fee_manager_private_key>
  replica_config:
    replica_id: 0
    total_replicas: 2
    backup_delay_seconds: 30
  run_config:
    disable_fee_adjustment: false  # Enable fee management (default)
    disable_fee_withdrawal: false

# Replica 1 (non-fee-manager wallet) - handles odd sequence numbers only
keeper:
  private_key:
    value: 0x<other_keeper_private_key>
  replica_config:
    replica_id: 1
    total_replicas: 2
    backup_delay_seconds: 30
  run_config:
    disable_fee_adjustment: true   # Disable fee management
    disable_fee_withdrawal: true
```

**Three Replica Setup:**
```yaml
# Replica 0 (fee manager wallet) - handles sequence numbers 0, 3, 6, 9, ... + fee management
keeper:
  replica_config:
    replica_id: 0
    total_replicas: 3
    backup_delay_seconds: 30
  run_config:
    disable_fee_adjustment: false
    disable_fee_withdrawal: false

# Replicas 1 & 2 (non-fee-manager wallets) - request processing only
keeper:
  replica_config:
    replica_id: 1  # or 2
    total_replicas: 3
    backup_delay_seconds: 30
  run_config:
    disable_fee_adjustment: true
    disable_fee_withdrawal: true
```

### Deployment Considerations

1. **Separate Wallets**: Each replica MUST use a different private key to avoid nonce conflicts
2. **Fee Manager Assignment**: Set the provider's `fee_manager` address to match the primary instance's keeper wallet
3. **Thread Configuration**: Only enable fee management threads on the instance using the fee manager wallet
4. **Backup Delay**: Set `backup_delay_seconds` long enough to allow primary replica to process requests, but short enough for acceptable failover time (recommended: 30-60 seconds)
5. **Monitoring**: Monitor each replica's processing metrics to ensure proper load distribution
6. **Gas Management**: Each replica needs sufficient ETH balance for gas fees

### Failover Behavior

- Primary replica processes requests immediately
- Backup replicas wait for `backup_delay_seconds` before checking if request is still unfulfilled
- If request is already fulfilled during the delay, backup replica skips processing
- This prevents duplicate transactions and wasted gas while ensuring reliability
- Fee management operations (adjustment/withdrawal) only occur on an instance where the keeper wallet is the fee manager wallet.

## Local Development

To start an instance of the webserver for local testing, you first need to perform a few setup steps:

1. Create a `config.yaml` file to point to the desired blockchains and Entropy contracts. Copy the content in `config.sample.yaml` and follow the directions inside to generate the necessary private keys and secrets.
1. Make sure the wallets you have generated in step (1) contain some gas tokens for the configured networks.
1. Run `cargo run -- setup-provider` to register a randomness provider for this service. This command
   will update the on-chain contracts such that the configured provider key is a randomness provider,
   and its on-chain configuration matches `config.yaml`.

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
