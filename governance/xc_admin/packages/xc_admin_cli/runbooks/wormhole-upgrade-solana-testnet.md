# Runbook: Upgrading the Wormhole Contract on Solana Testnet via Governance Proposal

This runbook describes the process for submitting a governance proposal to upgrade the Wormhole contract on Solana testnet using the `xc_admin_cli` tool.

## Prerequisites

Before starting the upgrade process, ensure you have the following:

1. **Access to ops keys**: The operational key used for signing transactions. The default ops key path is `~/.config/solana/ops-key.json`.

2. **New Wormhole program binary**: The compiled `.so` file for the new Wormhole program version you want to deploy.

3. **Wormhole program ID on testnet**: The address of the Wormhole program to be upgraded. For pythtest-conformance/pythtest-crosschain, this is `EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z`.

4. **Testnet multisig vault address**: The Squads multisig vault that controls the Wormhole program. For testnet, this is `FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj`.

5. **Testnet multisig authority address**: The PDA of the vault that serves as the upgrade authority. This is derived from the vault address and can be obtained by running:
   ```bash
   # The authority PDA is derived from the vault using Squads' getAuthorityPDA method
   # You can find this by inspecting the program's upgrade authority on-chain
   ```

6. **Solana CLI installed**: Ensure you have the Solana CLI tools installed and configured for testnet.

7. **Sufficient SOL balance**: The ops key needs enough SOL to pay for buffer creation and transaction fees.

## Step 1: Generate a New Keypair for the Buffer Account

Create a new keypair that will be used as the buffer account address:

```bash
solana-keygen new -o upgrade-buffer.json --no-bip39-passphrase
```

This generates a new keypair and saves it to `upgrade-buffer.json`. Note the public key output, as you'll need it later.

## Step 2: Write the Program Binary to the Buffer

Write the new Wormhole program binary to the buffer account using the Solana CLI:

```bash
solana program write-buffer \
  --url https://api.testnet.solana.com \
  --keypair ~/.config/solana/ops-key.json \
  --buffer upgrade-buffer.json \
  <PATH_TO_WORMHOLE_PROGRAM.so>
```

Replace `<PATH_TO_WORMHOLE_PROGRAM.so>` with the path to your compiled Wormhole program binary.

This command will output the buffer address. Save this address as `<BUFFER_PUBKEY>` for the next steps.

**Note**: This process may take several minutes depending on the program size and network conditions.

## Step 3: Change Buffer Authority (CRITICAL STEP)

> **WARNING**: This step is critical and must not be skipped. The buffer authority must be changed from the ops key to the multisig authority address before creating the upgrade proposal. If this step is skipped, the upgrade proposal will fail because the buffer authority won't match the expected upgrade authority.

Use the Solana CLI to transfer the buffer authority to the multisig authority PDA:

```bash
solana program set-buffer-authority \
  --url https://api.testnet.solana.com \
  --keypair ~/.config/solana/ops-key.json \
  <BUFFER_PUBKEY> \
  --new-buffer-authority <MULTISIG_AUTHORITY_ADDRESS>
```

Replace:
- `<BUFFER_PUBKEY>`: The buffer address from Step 2
- `<MULTISIG_AUTHORITY_ADDRESS>`: The multisig vault's authority PDA

**Why is this necessary?** The BPF upgradeable loader requires that the buffer authority matches the program's upgrade authority when executing an upgrade. Since the Wormhole program's upgrade authority is the multisig authority PDA, the buffer authority must also be set to this address.

## Step 4: Build the xc_admin_cli Tool

Navigate to the pyth-crosschain repository and build the CLI tool:

```bash
cd governance/xc_admin
pnpm i
pnpm turbo build --filter @pythnetwork/xc-admin-cli
```

## Step 5: Create the Upgrade Proposal

Run the `upgrade-program` command from the `xc_admin_cli` package directory:

```bash
cd governance/xc_admin/packages/xc_admin_cli

pnpm run cli upgrade-program \
  --cluster pythtest-conformance \
  --wallet ~/.config/solana/ops-key.json \
  --vault FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj \
  --program-id <WORMHOLE_PROGRAM_ID> \
  --buffer <BUFFER_PUBKEY>
```

Replace:
- `<WORMHOLE_PROGRAM_ID>`: The Wormhole program address (e.g., `EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z`)
- `<BUFFER_PUBKEY>`: The buffer address from Step 2

**What this command does:**
1. Creates a BPF upgradeable loader upgrade instruction
2. Wraps it in a Squads multisig proposal
3. Activates the proposal
4. Casts the first approval vote (from the ops key)

The command will output the proposal address upon success.

## Step 6: Approval Process

After the proposal is created, it needs to be approved by the multisig members:

1. **View the proposal**: The proposal will appear in the governance proposals interface at `https://proposals.pyth.network/`

2. **Coordinate approval**: For testnet, coordinate with multisig members in the appropriate Slack channel to gather approvals.

3. **Required signatures**: The testnet multisig requires 13 of 19 signatures to approve a proposal.

4. **Approval timeline**: Allow sufficient time for multisig members across different time zones to review and approve the proposal.

## Step 7: Execution

Once the proposal has received the required number of approvals:

1. **Execute the proposal**: Any multisig member can execute the approved proposal through the governance interface or CLI.

2. **Verify the upgrade**: After execution, verify that the Wormhole program has been upgraded by checking the program's data account or running a test transaction.

3. **Buffer cleanup**: The buffer account should be automatically closed after a successful upgrade, and the rent will be returned to the spill address specified in the upgrade instruction.

## Troubleshooting

### Transaction fails to land

If the CLI reports a timeout but you're unsure if the transaction landed:

1. Check the transaction signature on Solscan or Solana Explorer
2. There's a known issue where the RPC may land the transaction after the client times out
3. Wait a few minutes and check if the proposal appears in the governance interface

### Buffer authority mismatch error

If you see an error about buffer authority not matching:

1. Verify you completed Step 3 (changing buffer authority)
2. Check the current buffer authority using:
   ```bash
   solana program show --url https://api.testnet.solana.com <BUFFER_PUBKEY>
   ```
3. Ensure the buffer authority matches the multisig authority PDA

### Insufficient funds

If the transaction fails due to insufficient funds:

1. Check the ops key balance:
   ```bash
   solana balance --url https://api.testnet.solana.com ~/.config/solana/ops-key.json
   ```
2. Request testnet SOL from a faucet if needed

### Proposal not appearing

If the proposal doesn't appear in the governance interface:

1. Wait a few minutes for indexing
2. Check the transaction on-chain using the proposal address
3. Verify you're looking at the correct cluster (testnet vs mainnet)

## Important Notes

- **Cluster-specific vaults**: The governance system uses different multisig vaults per cluster. Testnet has its own vault separate from mainnet. Always verify you're using the correct vault address for your target cluster.

- **Authority requirements**: The vault's authority PDA must be the current upgrade authority of the Wormhole program. If the program's upgrade authority has been changed, you'll need to use the correct multisig that controls it.

- **Proposal batching**: The `proposeInstructions()` method handles creating the Squads proposal and will automatically batch instructions if needed for larger payloads.

- **RPC reliability**: Consider using a reliable RPC endpoint. If you experience timeouts, you can specify a custom RPC URL using the `--rpc-url-override` flag.

## Reference: Key Addresses

| Item | Address |
|------|---------|
| Testnet Upgrade Multisig Vault | `FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj` |
| Upgrade Ops Key | `opsLibxVY7Vz5eYMmSfX8cLFCFVYTtH6fr6MiifMpA7` |
| Wormhole (pythtest-conformance) | `EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z` |
| BPF Upgradeable Loader | `BPFLoaderUpgradeab1e11111111111111111111111` |
