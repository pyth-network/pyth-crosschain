# Cardano Lazer Contracts

## Project structure

- `aiken/` — On-chain Plutus validators (Aiken language)
  - `validators/signer_nft.ak` — Manages signer NFT lifecycle (mint/spend/else)
  - `validators/pyth_price.ak` — Price verification via staking withdraw (withdraw/else)
  - `lib/validate.ak` — Ed25519 signature verification and message parsing
  - `plutus.json` — Generated blueprint (do not edit manually)
- `typescript/` — Off-chain TypeScript library
  - `src/admin.ts` — Contract owner API: mint/burn NFT, update signers, register staking
  - `src/dapp.ts` — dApp developer API: build price verification transactions
  - `src/parse.ts` — Parse Pyth Lazer wire format messages
  - `src/validate.ts` — Off-chain signature and policy validation
  - `src/hex.ts` — Shared hex/bytes conversion utilities
  - `src/types.ts` — Type definitions and constants
  - `test/` — Unit tests (vitest)
  - `integration_test/` — Integration tests against local Yaci devnet

## Aiken

Aiken suppresses error details when stderr is not a TTY. Use `expect` to provide a pseudo-TTY:

```bash
cd aiken
expect -c 'spawn aiken build; expect eof'
expect -c 'spawn aiken check; expect eof'
```

After modifying Aiken validators, rebuild to regenerate `plutus.json` before running TypeScript tests.

## TypeScript

```bash
cd typescript
npm test                  # unit tests only
npm run test:integration  # integration tests only (requires running devnet)
```

### Integration tests

Run `./scripts/run-integration-tests.sh` to set up a local Yaci devnet and run integration tests. Requires Docker and Yaci DevKit.

## Common pitfalls

- Aiken 2-tuples `(A, B)` encode as Plutus lists `[A, B]`, not `Constr 0 [A, B]`.
- Mesh SDK `wallet.getChangeAddress()` and `wallet.signTx()` return Promises — always `await` them.
- `MeshTxBuilder.complete()` requires `selectUtxosFrom(utxos)` for coin selection and `txInCollateral()` for Plutus script transactions.
- The `Assets` type from `cardano/assets` is not public in Aiken — omit the type annotation and let it be inferred.
- Use `serializeRewardAddress()` (not `serializePlutusScript`) to get `stake_test1...` bech32 reward addresses.
