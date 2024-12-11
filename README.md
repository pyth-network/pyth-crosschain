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

### TypeScript Version Requirements

The project requires TypeScript version >=4.7.4 <5.5.0. Using versions outside this range may result in linting warnings.

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

#### Building a new package

New packages should be configured with a few requirements in mind:

1. You need to make sure `package.json` scripts are named such that that
   turborepo will hook into them at the expected times.

   - See [turbo.json](./turbo.json) to see the base configuration and ensure you
     use script names that match the tasks that turborepo is configured to run.
   - You don't need to define scripts for all the tasks that are in the root
     `turbo.json` config, just define the ones that make sense for your project.
   - You shouldn't define scripts for tasks that just trigger other tasks;
     instead configure turborepo dependencies to trigger the tasks. This will
     allow turborepo to cache and parallelize things more effectively.
   - In general, `build`, `fix`, and `test` are the main turborepo task graph
     entry points, and any sub-tasks that apply to your package should be
     configured as dependencies somewhere in the graph rooted at one of those.
   - If you need sub-tasks or a task configuration that only apply to your or a
     small few packages, add a package-scoped `turbo.json`, see [the one in the
     insights app](./apps/insights/turbo.json) as an example.

2. Make sure to configure the tools you need and hook up the relevant checks to
   turborepo via the `test` root task so they run on CI. The most common tools
   (eslint, prettier, jest, and typescript) are trivial to configure correctly
   using shared configs, see the relevant config files [in the insights
   app](./apps/insights) as a starting point.

3. If you are writing a package that will be published:

   - Make sure you are dual-exporting cjs and esm correctly, see [how the lazer
     sdk package builds](./lazer/sdk/js/package.json) (in particular look at the
     `build:cjs` and `build:esm` tasks) for an example for how to do this

   - Ensure you have properly configured [subpath
     exports](https://nodejs.org/api/packages.html#subpath-exports) to reference
     the esm and cjs outputs so that your package can be consumed correctly in
     both environments. Again, see [the lazer sdk](./lazer/sdk/js/package.json)
     as an example for doing this correctly.

   - Ensure you have set a `main` and `types` property on your `package.json`
     pointing to your cjs entrypoint for use in older javascript environments.

   - Ensure you configure the `files` property on your `package.json` to include
     all output files and to exclude source files & tooling configuration. This
     will result in smaller package sizes.

## Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.
