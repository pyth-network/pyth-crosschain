# pyth-lazer-sdk - Readme

## Contributing & Development

See [contributing.md](docs/contributing/contributing.md) for information on how to develop or contribute to this project!

## Installation and build

### pnpm

```
cd to crosschain root
$ pnpm install
$ pnpm turbo --filter @pythnetwork/pyth-lazer-sdk build
```

As part of the build, files will be generated from the proto files found in the lazer/proto folder. These generated files are placed in the src/generated/ folder. 
