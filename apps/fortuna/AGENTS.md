# Repository Guidelines

## Project Structure & Module Organization
Runtime code sits in `src/`, with `api/`, `chain/`, `keeper/`, and `command/` owning HTTP routes, blockchain adapters, keeper loops, and CLI verbs exposed by `main.rs`. Shared types live in `lib.rs`, configuration templates in `config.sample.yaml`, migrations in `migrations/`, and build helpers (Dockerfile, flake.nix, check-sqlx.sh) at the root.

## Build, Test, and Development Commands
- `cargo build --workspace`: compile the web service and helper binaries.
- `cargo test [-- --nocapture]`: run unit/integration suites, optionally showing logs.
- `RUST_LOG=INFO cargo run -- run`: start the local server using `config.yaml`.
- `cargo run -- setup-provider`: register the randomness provider specified in the config.
- `cargo sqlx migrate run` or `database reset`: apply or reset schema using the `.env` `DATABASE_URL`.
- `./check-sqlx.sh`: ensure SQLx offline metadata is current before DB-affecting commits.
- `cli start | cli test | cli fix`: Nix-shell shortcuts for watch, verify, and autofix loops.

## Coding Style & Naming Conventions
Always run `cargo fmt --all` and `cargo clippy --all-targets --all-features -D warnings` so submissions match CI expectations (4-space indent, trailing commas, no lint debt). Modules and files use snake_case, public structs/enums use PascalCase, and constants remain SCREAMING_SNAKE_CASE. Align YAML/TOML samples with `config.sample.yaml`, and reference secrets by env var rather than literals.

## Testing Guidelines
Keep module-level tests inside the relevant file (`#[cfg(test)]` blocks) and add `tests/` integration suites for CLI flows or keeper orchestration. Run `cargo sqlx migrate run` after editing migrations so `cargo test` interacts with the right schema. Prioritize coverage on chain adapters, keeper scheduling, replica assignment, and API pagination, mocking RPC traits to avoid network flakiness.

## Commit & Pull Request Guidelines
Git history uses `type(scope): summary` (`fix(lazer)`, `chore(contract-manager): ...`), so keep subjects imperative and ≤72 characters, and isolate unrelated changes. Include regenerated SQLx data or config snapshots in the same commit that needs them. PRs should describe motivation, list the verification commands executed (`cargo test`, `./check-sqlx.sh`, etc.), and attach logs or screenshots whenever behavior changes. 
**Important**: When changing code, bump the package version in `Cargo.toml` based on semantic versioning. Run `cargo check` to ensure the changes are reflected in the Cargo.lock lockfile.

## Security & Configuration Tips
Do not commit `config.yaml`, `.env`, or private keys—derive them from `config.sample.yaml` and inject secrets through env vars or secret stores. Each replica must run with unique `keeper.private_key` values, and only the fee-managing instance should hold `keeper.fee_manager_private_key`. Remove sensitive details from logs before sharing and rotate credentials immediately if a leak is suspected.
