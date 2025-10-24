# build-ts-package

A simple CLI utility for compiling TypeScript libraries and packages
that supports dual publishing to both CommonJS and ESM formats.

This tool uses TypeScript directly, to avoid any strange bundling issues,
and it will respect your available `tsconfig.build.json` or `tsconfig.json` files,
if present.

## Usage

Place the following in your `package.json#scripts.build` section:

```
build-ts-package
```

If you need more options or specialized configuration, do `build-ts-package --help` to see the available options:

```bash

```
