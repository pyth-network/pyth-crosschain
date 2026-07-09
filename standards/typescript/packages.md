# Creating a new JavaScript / TypeScript package

This document explains how to quickly bootstrap a new JS / TS package and the best
practices to follow. These practices are generally applicable regardless of the
type of package you're building (UI component, util library, server client, etc.)
and regardless of where you house it.

## Using the `create-pyth-package` generator

1. Ensure you have run `pnpm install` from the root of the
   [pyth-crosschain](https://github.com/pyth-network/pyth-crosschain) repository.
2. Run `pnpm create-pyth-package` and answer the prompts.
3. Find your generated code in the repository, in the folder you chose.
4. Happy hacking!

## Best practices

- Put your code in a `src/` folder.
- Use a very strict TypeScript `tsconfig.json` that leverages a common base.
- Use [Biome](https://biomejs.dev/) for linting and formatting (see
  [style.md](style.md)).
- Write your code using the most modern syntax.
- Compile your code to both
  [CommonJS (CJS)](https://nodejs.org/api/modules.html#modules-commonjs-modules) and
  [ECMAScript Module (ESM)](https://nodejs.org/api/esm.html#introduction).
- Write tests using our internal test configuration (see [testing.md](testing.md)).
  Locate tests near the file / code you are testing, and ensure the filename ends
  with `*.test.ts` (or `*.test.tsx` for a React component).
- Have a `src/index.ts` file as the single place where you export the functions,
  APIs, etc. that you want your users to use.
- Have a readme with steps to guide users through installing the package, getting
  started, and some samples (if relevant).
- For any dependencies, leverage the `catalog:` version instead of declaring your
  own package-specific dependency version.
