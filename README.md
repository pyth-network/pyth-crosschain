# Pyth Crosschain

This repository acts as a monorepo for the various components that make up
Pyth protocols.

Within this monorepo you will find the following subprojects:

## Table of Contents

- [Target Chains](#target-chains)
- [Hermes](#hermes)
- [Fortuna](#fortuna)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Contribution workflow](#contribution-workflow)
  - [Testing](#testing)
  - [Releases](#releases)
  - [Typescript Monorepo](#typescript-monorepo)
    - [Setting up](#setting-up)
    - [Common tasks](#common-tasks)
    - [Building a new web app, JS / TS library or CLI tool](#building-a-new-web-app-js--ts-library-or-cli-tool)
- [Audit / Feature Status](#audit--feature-status)

## Target Chains

> [target_chains](./target_chains/)

This directory contains on-chain contracts and SDKs for all of the various
blockchain runtimes that Pyth supports. Each subdirectory corresponds to a
blockchain runtime. Inside each subdirectory, there are subfolders for
contracts and SDKs.

## Hermes

> [hermes](./apps/hermes/)

Hermes is an off-chain service which constantly observes Pythnet and the
Wormhole network watching for price updates emitted from the Pyth contract. It
exposes all observed attestations via a public API over HTTPS/WSS which can be
consumed by client-side applications that wish to use Pyth pricing data.

The [`price_service/client`](./price_service/client/) directory provides an SDK for interacting with Hermes.
However, most users will interact with the price service via a chain-specific SDK

For a guide on utilising this service in your project, see the chain-specific SDK
and [examples](https://github.com/pyth-network/pyth-examples/tree/main/price_feeds) for your blockchain runtime in the `target_chains` directory.

## Fortuna

> [fortuna](./apps/fortuna/)

Fortuna is an off-chain service which can be used by [Entropy](https://pyth.network/entropy) providers.

## Local Development

### Setup

Please install the following tools in order to work in this repository:

- [NVM](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) to manage your node version, then run `nvm use 22` to ensure you are using node version 22.
  - Optionally, you can also use [mise](https://mise.jdx.dev/). If you install `mise`, you can run all of your commands like the following: `mise x -- pnpm <SOME_COMMAND>`, which will ensure you are running your commands while using the correct tool versions for this repository.
- [Foundry](https://book.getfoundry.sh/getting-started/installation) in order to use `forge` for Ethereum contract development
- [Solana CLI](https://solana.com/docs/intro/installation) for working with Solana programs.
  - After installing, please run `solana keygen new` to generate a local private key.
- [Anchor](https://www.anchor-lang.com/docs/installation) for developing Solana programs.
- [Pre-commit](https://pre-commit.com/) is used to automatically format and lint the repository.
  - After installing, please run `pre-commit install` in the root of the repo to configure the checks to run on each git commit.
- [Rust](https://www.rust-lang.org/tools/install)

### Contribution workflow

Use the [Conventional Commits](https://www.conventionalcommits.org) format for commit messages and PR titles. In PRs,
include a short summary plus relevant context, and update versions following [Semantic Versioning](https://semver.org/).
Install and use `pre-commit` (`pre-commit install`) so formatting and lint checks run before each commit.

See also: [Code guidelines](doc/code-guidelines.md) and [JavaScript/TypeScript guidelines](doc/js-code-guidelines.md).
Security reports should follow [SECURITY.md](./SECURITY.md).

### Testing

- `pnpm turbo test` runs tests, linting, and formatting checks for the JS/TS monorepo.
- `pnpm turbo fix` applies auto-fixes where available.
- `cargo test` / `cargo build` apply for Rust components when relevant.
- `pre-commit run --all-files` runs the repo-wide checks locally.

### Releases

CI workflows release components when a GitHub release is published. Each component uses a tag format that includes the
component name and version (e.g., `fortuna-vX.Y.Z`). JavaScript packages are released together with a `pyth-js-v<number>`
tag. See the GitHub Releases page for existing tags and naming. The general process is:

1. Update the version number of the component in the repo, e.g., in `package.json` or `Cargo.toml` or wherever. Please follow [Semantic Versioning](https://semver.org/) for package versions.
2. Submit a PR with the changes and merge them in to main.
3. Create a GitHub release that creates the appropriate tag on publish (see [Releases](https://github.com/pyth-network/pyth-crosschain/releases)).
4. Publish the release to trigger the GitHub Actions workflow (e.g., publish to npm or build/push Docker images).
   - Note that when publishing a public package, you should prune the auto-generated Github release notes to only include changes relevant to the release. Otherwise, the changelog will include commits from unrelated projects in the monorepo since the previous release.

If you have a javascript package that shouldn't be published, simply add `"private": "true"` to the `package.json` file
and it will be excluded from the publishing workflow. If you are creating a new public javascript package, you should add
the following config option to `package.json`:

```
  "publishConfig": {
    "access": "public"
  },
```

### Typescript Monorepo

All of the typescript / javascript packages in this repository are part of a
[turborepo](https://turbo.build/repo/docs) monorepo.

#### Setting up

If you use nix and direnv, just cd to the project directory and `direnv allow`.

If you use nix but not direnv, just cd to the project directory and enter a nix
development shell with `nix develop`.

If you don't use nix at all, then install the required system packages:

- [Node.js](https://nodejs.org/en) -- match the version to `.nvmrc`; you can use
  [nvm](https://github.com/nvm-sh/nvm) to manage your Node.js version.
- [pnpm](https://pnpm.io/) -- match the version to the version specified in
  `package.json`; you can experiment with
  [corepack](https://nodejs.org/api/corepack.html) to manage your pnpm version
  for you.

#### Common tasks

The following tasks are the most common ways to interact with the monorepo.
Thanks to [turborepo](https://turbo.build/repo/docs), these tasks will
coordinate building any needed dependencies, and task execution will be cached
and will only re-run as necessary. For any of the following tasks, you can pass
[any valid `turbo run` option](https://turbo.build/repo/docs/reference/run)
after `--`, for instance you could run `pnpm test -- --concurrency 2`.

- `pnpm turbo test`: Run all unit tests, integration tests, linting, and format
  checks, as well as whatever other code checks any packages support.
- `pnpm turbo fix`: Run auto fixes, including reformatting code and auto-fixing
  lint rules where possible.
- `pnpm turbo start:dev`: Start all development servers in parallel.
- `pnpm turbo start:prod`: Run production builds and start production mode
  servers in parallel.

#### Building a new web app, JS / TS library or CLI tool

To quickly get started, from the root of this repo, you can run the following:

1. `pnpm create-pyth-package`
2. Answer the prompts
3. Once the script is done, you will have your new webb app, library or CLI tool bootstrapped with all the current best practices.

If you'd like to read more about the best practices, checkout this best practices doc:
[🔗 Creating a new JavaScript / TypeScript Package](./doc/js-code-guidelines.md)

## Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the [License](./LICENSE) for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.
