# Pyth Crosschain

This repository acts as a monorepo for the various components that make up
Pyth Crosschain.

Within this monorepo you will find the following subprojects:

## Wormhole Attester

> wormhole_attester

The main Pyth implementation currently exists as an [on-chain contract][] on
Pythnet, a separate instance of the Solana blockchain. In order to expose
these prices cross-chain, the Wormhole Attester contract acts as a sender for Pyth prices. At regular intervals the Pyth
contract will observe the current Pyth price for selected products, and produce
an attestation which is then relayed over Wormhole to be consumed by the
various receiver contracts.

[on-chain contract]: https://github.com/pyth-network/pyth-client

## Target Chains

> target_chains

This directory contains on-chain contracts and SDKs for all of the various
blockchain runtimes that Pyth supports. Each subdirectory corresponds to a
blockchain runtime. Inside each subdirectory, there are subfolders for
contracts, SDKs, and examples.

## Price Service

> price_service

The Price Service is an off-chain service which constantly observes the
Wormhole network watching for price attestations emitted from the Pyth
contract. It exposes all observed attestations via a public API over HTTPS/WSS
which can be consumed by client-side applications that wish to use Pyth pricing
data.

The `client` subdirectory provides an SDK for interacting with the price service.
However, most users will interact with the price service via a chain-specific SDK

For a guide on utilising this service in your project, see the chain-specific SDK
and examples for your blockchain runtime in the `target_chains` directory.

## Development

### Pull requests

Use the following format for naming the pull requests:

[component] PR description

For example:

[hermes] Add storage tests

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

All of the typescript / javascript packages in this repository are part of a lerna monorepo.
This setup allows each package to reference the current version of the others.
You can install dependencies using `npm ci` from the repository root.
You can build all of the packages using `npx lerna run build` and test with `npx lerna run test`.

Lerna has some common failure modes that you may encounter:

1. `npm ci` fails with a typescript compilation error about a missing package.
   This error likely means that the failing package has a `prepare` entry compiling the typescript in its `package.json`.
   Fix this error by moving that logic to the `prepublishOnly` entry.
1. The software builds locally but fails in CI, or vice-versa.
   This error likely means that some local build caches need to be cleaned.
   The build error may not indicate that this is a caching issue, e.g., it may appear that the packages are being built in the wrong order.
   Delete `node_modules/`, `lib/` and `tsconfig.tsbuildinfo` from each package's subdirectory. then try again.

## Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.
