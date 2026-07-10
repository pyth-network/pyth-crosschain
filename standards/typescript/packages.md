# Creating a new JavaScript / TypeScript package

How to bootstrap a new JS / TS package and the best practices to follow. These
apply to any kind of package (UI component, util library, server client, etc.)
wherever you house it.

## Using the `create-pyth-package` generator

1. Ensure you have run `pnpm install` from the root of the
   [pyth-crosschain](https://github.com/pyth-network/pyth-crosschain) repository.
2. Run `pnpm create-pyth-package` and answer the prompts.
3. Find your generated code in the folder you chose.
4. Happy hacking!

## Best practices

- Put your code in a `src/` folder.
- Use a very strict TypeScript `tsconfig.json` that leverages a common base.
- Use [Biome](https://biomejs.dev/) for linting and formatting (see
  [style.md](style.md)).
- Write your code using the most modern syntax.
- Compile to both
  [CommonJS (CJS)](https://nodejs.org/api/modules.html#modules-commonjs-modules) and
  [ECMAScript Module (ESM)](https://nodejs.org/api/esm.html#introduction).
- Write tests with our internal test configuration (see [testing.md](testing.md)),
  located near the code under test, with a `*.test.ts` (or `*.test.tsx`) filename.
- Have a `src/index.ts` as the single place exporting your public APIs.
- Have a readme covering install, getting started, and samples (if relevant).
- For dependencies, use the `catalog:` version rather than a package-specific one.
