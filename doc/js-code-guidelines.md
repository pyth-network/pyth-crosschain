# Creating a new JavaScript / TypeScript Package

# Table of Contents

1. [What is this?](#what-is-this)
2. [Using the `create-pyth-package` generator](#using-the-create-pyth-package-generator)
3. [Best Practices](#best-practices)

### What is this?

This document contains links to sample packages to use to help you quickly bootstrap a new JS / TS package, as well as context about best practices.

These practices are generally applicable, regardless of the type of package you’re building (UI component, util library, server client, etc), as well as regardless of the location where you’ll be housing the package.

This guide has code samples and examples for projects related to pyth in the `pyth-crosshain` repository. Everything in here is generally applicable, except the test configuration, which will be called out separately in the test file section.

---

# Using the `create-pyth-package` generator

1. Ensure you have run `pnpm install` from the root of the [pyth-crosschain](https://github.com/pyth-network/pyth-crosschain) repository
2. run `pnpm create-pyth-package` and answer the prompts
3. Find your generated code in the repository, in the folder you chose
4. Happy hacking!

# Best Practices

- Put your code in a `src/` folder
- Use a very strict TypeScript `tsconfig.json` file that leverages a common base
- Use a very strict eslint configuration (helps standardize on code quality)
- Use [prettier](https://prettier.io/) to help format your code ([VSCode extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and [CLI](https://www.npmjs.com/package/prettier))
- Write your code using the most modern syntax
- Compile your code to both [CommonJS (CJS)](https://nodejs.org/api/modules.html#modules-commonjs-modules) and [ECMAScript Module (ESM)](https://nodejs.org/api/esm.html#introduction)
- Write tests using our internal test configuration
- When writing tests, locate the tests near the file / code you are testing, and ensure the filename ends with `*.test.ts` (or `*.test.tsx` if you are testing a React component)
- Have a `src/index.ts` file as a single place where you export any functions, APIs, etc that you want your users to use
- Have a readme with steps to guide users to installing the package, getting started and some samples (if relevant)
- For any dependencies, try to leverage the `catalog:` version instead of declaring your own package-specific dependency version.
