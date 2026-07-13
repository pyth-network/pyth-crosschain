# Code Review Guidelines

## Mandatory Checks (reject if any fail)

### No merge conflicts

The patch must apply cleanly to main. If not, ask the author to rebase and resubmit.

### Tests pass

All existing tests must pass. Flag any test breakage introduced by the diff.

### Formatting and linting clean

Rust must follow `rustfmt` and the project's strict `clippy` config; TypeScript/JavaScript must follow Biome. Flag obvious formatting or lint issues.

### No accidental file commits

Flag files that should not be in the repo (generated files, `.env`, credentials, `documents/`).

### No serious performance problems

Reject significant performance regressions. Watch frontend code for excessive or redundant backend requests (UI N+1, undebounced polling, fetching in loops, missing pagination, re-fetching cached data) and backend code for inefficient queries, missing indexes, or O(n²) patterns on large datasets.

## Code Quality Checks

### Scope discipline

The change should do one thing well. Flag PRs that do too much, include unrelated changes, or add unnecessary complexity.

### Use existing infrastructure

Prefer extending existing types, endpoints, and patterns over adding parallel ones. For TypeScript dependencies, prefer `catalog:` versions over package-specific versions.

### Proper code organization

Shared logic belongs in shared packages (e.g., `packages/shared-lib`, `packages/component-library`); flag duplication across packages or crates. Avoid catch-all modules like `types/` or `utils/`; keep types and functions near their use and lift them to a common parent only when reused. Follow layered architecture (API, business logic, data logic).

### API design consistency

Follow established patterns. New types should use existing ID types rather than raw strings.

### Test coverage

New functionality needs tests; refactoring must not break existing tests. Removed tests need a clear reason.

### Reusable logic identification

If the change duplicates logic that exists elsewhere, suggest using the existing implementation. If it solves a general problem others could use, suggest extracting it into a shared package (e.g., `packages/shared-lib`) or common Rust crate as a follow-up.

### Follow-up awareness

For tangential improvements out of scope, suggest the author file follow-up issues rather than expanding the current change.

### Performance awareness

Consider performance implications. Frontend code should minimize backend requests — batch, cache, and avoid needless re-fetches. Backend code should use efficient queries and avoid over-fetching. Flag significant increases in API calls or database queries and suggest optimizations.

### Rust-specific checks

- Avoid panics: flag `.unwrap()`, `.expect()`, `panic!()`, and `[]` indexing where `.get()` works. Prefer `Result` handling with `anyhow`/`thiserror`.
- Avoid unchecked arithmetic: flag `+`, `-`, `*` on integers that could overflow; prefer `.checked_*()` or `.saturating_*()`.
- Avoid implicit truncation with `as`; prefer `.into()`, `T::from()`, or `.try_into()`.
- Use the project's essential crates (`tracing`, `anyhow`, `thiserror`, `axum`, `tokio`, etc.) rather than alternatives.
- Add relevant context to errors with `.with_context()`.
- Preserve error sources — don't stringify errors via `to_string()` or `{}`.
- No unsafe code unless absolutely necessary.

## Cross-Service Impact

Check whether the change affects other services (e.g., those sharing a table or type). This monorepo has many interconnected services (Hermes, Fortuna, Argus, etc.) and cross-chain contracts, so cross-service impact is easy to miss.

## Language Best Practices

Check that the code follows the language's best practices. See the sibling standards: [style.md](style.md), [testing.md](testing.md), [services.md](services.md), the [rust/](rust/AGENTS.md) cluster, and the [typescript/](typescript/AGENTS.md) cluster.

## Version Bumps

Check that changed public packages have version bumps. If not, raise it as info and suggest the bump level (patch/minor/major) and what changed. Suggest lock file updates when a bump happens.

## Test Coverage

Check that tests have enough coverage (unit, integration, etc.). If lacking, raise it as informational and suggest minimal behaviour tests plus corner cases.
