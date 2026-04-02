# Code Review Guidelines

## Mandatory Checks (reject if any fail)

### No merge conflicts

The patch must apply cleanly to main. If there are merge conflicts, request the author rebase on main and resubmit.

### Tests pass

All existing tests must pass. If the patch description mentions test failures or if the diff introduces obvious test breakage, flag it.

### cargo fmt / clippy clean

For Rust repos, verify the changes follow formatting and lint standards. If the diff shows obvious formatting issues, flag them.

### No accidental file commits

Check for files that should not be in the repo (e.g., documents/, generated files, .env files, credentials). Flag any suspicious additions.

### No serious performance problems

Reject patches that introduce significant performance issues. Pay special attention to frontend code that makes excessive or redundant requests to the backend (e.g., N+1 query patterns in the UI, polling without debouncing, fetching data in loops, missing pagination, or re-fetching data that is already available in cache). Also flag backend changes that introduce obviously inefficient database queries, missing indexes, or O(n²) patterns on large datasets.

## Code Quality Checks

### Scope discipline

The change should do one thing well. Flag if the PR tries to do too many things at once, or includes unrelated changes. Over-engineered solutions that add unnecessary complexity should be called out.

### Use existing infrastructure

Prefer extending existing types, endpoints, and patterns over creating new ones. If the codebase already has a mechanism for something (e.g., a query object for filtering), the patch should use it rather than adding a parallel approach.

### Proper code organization

Shared logic should live in shared modules (e.g., hydra-common). Duplicated code across crates should be flagged. String formatting and helper logic should be extracted to dedicated files when substantial.

### API design consistency

Parameters should go in query/search objects, not as separate route parameters. New types should use existing ID types rather than raw strings. Follow established patterns in the codebase.

### Test coverage

New functionality should have tests. Refactoring should not break existing tests. If tests are removed, there should be a clear reason.

### Follow-up awareness

If you notice tangential improvements that are out of scope for this PR, suggest the author create follow-up issues rather than expanding the current change.

### Performance awareness

Consider the performance implications of changes. Frontend code should minimize the number of requests to the backend — batch where possible, use caching, and avoid unnecessary re-fetches. Backend code should use efficient queries and avoid loading more data than needed. If a change increases the number of API calls or database queries significantly, flag it and suggest optimization.

### Architectural anti-patterns

Check for common architectural anti-patterns, referencing the AGENTS.md architectural principles section where available:

- Using placeholder/sentinel values like 'unknown' or empty strings for mandatory fields
- Adding tokens/secrets to API types or WorkerContext instead of using environment variables
- Implementing reactive behavior as background workers instead of Automations
- Using builder/setter patterns (with_X methods) when constructor parameters would suffice
- Adding Default implementations for types that should always be explicitly set

## Cross-Service Impact

Check whether this change affects other services and they should be updated. Examples include services that reuse the same table or the same type. This is important and we shouldn't miss anything.

## Architecture Quality

Check whether the code change is architecturally good with high cohesion and low coupling. Avoid unnecessary abstractions and aim for simplicity. Raise it as a warning if it's bad.

## Language Best Practices

Check whether the code is written with the best practices of that language.

## Version Bumps

Check whether all the changed packages (that are public) have their versions bumped. Raise it as information if it's not bumped, make a suggestion on the bump (like whether it's patch/minor/major and what should change). Also suggest the lock file changes when a bump happens.

## Test Coverage

Check whether the tests have enough coverage (unit, integration, etc.). Raise it as informational if it's not there, also suggest ways to add minimal tests that test the behaviour and suggest tests for different corner cases.
