# Pyth Crosschain

This repository acts as a monorepo for the various components that make up
Pyth protocols.

Within this monorepo you will find the following subprojects:

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

## Development

### Pull requests

Use the [Conventional Commits](https://www.conventionalcommits.org) format for your commit messages and PR titles.
In the PR description, please include a summary of the changes and any relevant context. Also, please make sure
to update the package versions following the [Semantic Versioning](https://semver.org/) rules.

### Releases

The repository has a CI workflow that will release javascript packages whose version number has changed.
To perform a release, follow these steps:

1. Update the version number in the `package.json` file for the package(s) you wish to release. Please follow [Semantic Versioning](https://semver.org/) for package versions.
2. Submit a PR with the changes and merge them in to main.
3. Create a new tag `pyth-js-v<number>` and push to github. You can simply increment the version number each time -- it doesn't affect any of the published information.
4. Pushing the tag automatically triggers a CI workflow to publish the updated packages to NPM.

If you have a javascript package that shouldn't be published, simply add `"private": "true"` to the `package.json` file
and it will be excluded from the publishing workflow. If you are creating a new public javascript package, you should add
the following config option to `package.json`:

```
  "publishConfig": {
    "access": "public"
  },
```

### pre-commit hooks

pre-commit is a tool that checks and fixes simple issues (formatting, ...) before each commit. You can install it by following [their website](https://pre-commit.com/). In order to enable checks for this repo run `pre-commit install` from command-line in the root of this repo.

The checks are also performed in the CI to ensure the code follows consistent formatting.

### Tilt CI

Integration tests run in Tilt (via the `tilt ci` command). The Tilt CI workflow requires approval from a member of the Pyth team. If you are a member, click on "Details" next to the "Workflow / ci-pyth-crosschain" check in a pull request, and then on the "Resume" button on the workflow page.

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
- [turbo](https://turbo.build/repo/docs/getting-started/installation)

#### Common tasks

The following tasks are the most common ways to interact with the monorepo.
Thanks to [turborepo](https://turbo.build/repo/docs), these tasks will
coordinate building any needed dependencies, and task execution will be cached
and will only re-run as necessary. For any of the following tasks, you can pass
[any valid `turbo run` option](https://turbo.build/repo/docs/reference/run)
after `--`, for instance you could run `pnpm test -- --concurrency 2`.

- `pnpm test`: Run all unit tests, integration tests, linting, and format
  checks, as well as whatever other code checks any packages support.
- `pnpm fix`: Run auto fixes, including reformatting code and auto-fixing lint
  rules where possible.
- `pnpm start:dev`: Start all development servers in parallel.
- `pnpm start:prod`: Run production builds and start production mode servers in
  parallel.

## Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.
