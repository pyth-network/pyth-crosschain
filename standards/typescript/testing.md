# TypeScript testing

The cross-cutting [testing.md](../testing.md) applies — test-driven development is
required, and you never widen a package's exports just to reach something from a
test. This page covers the TypeScript-specific conventions.

- Use the repo's internal test configuration; a package generated with
  `pnpm create-pyth-package` comes wired for it.
- Locate tests next to the code they exercise, with a `*.test.ts` filename
  (`*.test.tsx` for a React component). Import from the module's own source rather
  than from the package's public entry point, so a test can reach an internal
  without it being added to `src/index.ts`.
- Test the behaviour a real caller would observe, not the implementation details.
