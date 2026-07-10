# Testing

Cross-cutting testing principles. Language-specific mechanics live in
[rust/testing.md](rust/testing.md) and [typescript/testing.md](typescript/testing.md).

## Test-driven development is required

Write the test before the implementation:

1. Write a test that describes the behaviour you want.
2. Run it and watch it fail — this proves the test exercises the new behaviour and isn't passing by accident.
3. Write the minimum code to make it pass.
4. Refactor with the test as your safety net.

Watching the test fail first is not optional; a test you never saw fail may assert nothing. New functionality lands with tests in the same change; a bug fix lands with a regression test that fails before the fix and passes after.

## Never widen an export just to test it

Visibility is part of your design. Do not make something `pub` (Rust) or add it to a package's public exports (TypeScript) solely so a test can reach it — that leaks internals into the public API, other code starts depending on them, and the "temporary" widening becomes permanent.

Instead:

- Test through the public surface real callers use. If a behaviour is reachable from the public API, it is testable from there.
- Keep the test next to the code so it can see private items without widening: in Rust, a `#[cfg(test)] mod tests` in the same file; in TypeScript, a `*.test.ts` importing from the module's own source rather than its published entry point.
- If a unit is hard to test only because it is buried in a larger function, extract it into its own well-named unit rather than exposing the larger function's internals.
