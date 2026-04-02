# Code Review Guidelines

## Mandatory Checks (reject if any fail)

### No merge conflicts

The patch must apply cleanly to main. If there are merge conflicts, request the author rebase on main and resubmit.

### Tests pass

All existing tests must pass. If the patch description mentions test failures or if the diff introduces obvious test breakage, flag it.

### Formatting and linting clean

For Rust code, verify changes follow `rustfmt` and `clippy` standards (with the project's strict clippy configuration). For TypeScript/JavaScript code, verify changes follow Biome linting and formatting standards. If the diff shows obvious formatting or lint issues, flag them.

### No accidental file commits

Check for files that should not be in the repo (e.g., generated files, .env files, credentials, documents/). Flag any suspicious additions.

### No serious performance problems

Reject patches that introduce significant performance issues. Pay special attention to frontend code that makes excessive or redundant requests to the backend (e.g., N+1 query patterns in the UI, polling without debouncing, fetching data in loops, missing pagination, or re-fetching data that is already available in cache). Also flag backend changes that introduce obviously inefficient database queries, missing indexes, or O(n²) patterns on large datasets.

## Code Quality Checks

### Scope discipline

The change should do one thing well. Flag if the PR tries to do too many things at once, or includes unrelated changes. Over-engineered solutions that add unnecessary complexity should be called out.

### Use existing infrastructure

Prefer extending existing types, endpoints, and patterns over creating new ones. If the codebase already has a mechanism for something, the patch should use it rather than adding a parallel approach. For TypeScript dependencies, prefer using `catalog:` versions over declaring package-specific dependency versions.

### Proper code organization

Shared logic should live in shared packages (e.g., `packages/shared-lib`, `packages/component-library`). Duplicated code across packages or crates should be flagged. Avoid catch-all modules like `types/` or `utils/`. Keep types and functions close to where they are used; only lift them to a common parent when they are reused. Follow layered architecture (separate API processing, business logic, and data logic).

### API design consistency

Follow established patterns in the codebase. New types should use existing ID types rather than raw strings.

### Test coverage

New functionality should have tests. Refactoring should not break existing tests. If tests are removed, there should be a clear reason.

### Follow-up awareness

If you notice tangential improvements that are out of scope for this PR, suggest the author create follow-up issues rather than expanding the current change.

### Performance awareness

Consider the performance implications of changes. Frontend code should minimize the number of requests to the backend — batch where possible, use caching, and avoid unnecessary re-fetches. Backend code should use efficient queries and avoid loading more data than needed. If a change increases the number of API calls or database queries significantly, flag it and suggest optimization.

### Rust-specific checks

When reviewing Rust code, pay attention to:

- Avoid panics: flag uses of `.unwrap()`, `.expect()`, `panic!()`, indexing with `[]` where `.get()` could be used. Prefer `Result`-based handling with `anyhow`/`thiserror`.
- Avoid unchecked arithmetic: flag `+`, `-`, `*` on integers that could overflow. Prefer `.checked_*()` or `.saturating_*()` methods.
- Avoid implicit truncation with `as`: prefer `.into()`, `T::from()`, or `.try_into()` for numeric conversions.
- Use the project's essential crates (`tracing`, `anyhow`, `thiserror`, `axum`, `tokio`, etc.) rather than introducing alternatives.
- Error messages should contain relevant context using `.with_context()`.
- Preserve error sources — avoid converting errors to strings with `to_string()` or `{}` formatting.
- No unsafe code unless absolutely necessary.

## Cross-Service Impact

Check whether this change affects other services and they should be updated. Examples include services that reuse the same table or the same type. This is a monorepo with many interconnected services (Hermes, Fortuna, Argus, etc.) and smart contracts across multiple chains — cross-service impact is easy to miss.

## Language Best Practices

Check whether the code is written with the best practices of that language. Refer to the project's code guidelines in `doc/code-guidelines.md`, `doc/rust-code-guidelines.md`, and `doc/js-code-guidelines.md`.

## Version Bumps

Check whether all the changed packages (that are public) have their versions bumped. Raise it as information if it's not bumped, make a suggestion on the bump (like whether it's patch/minor/major and what should change). Also suggest the lock file changes when a bump happens.

## Test Coverage

Check whether the tests have enough coverage (unit, integration, etc.). Raise it as informational if it's not there, also suggest ways to add minimal tests that test the behaviour and suggest tests for different corner cases.
