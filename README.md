# Pyth Crosschain

This repository acts as a monorepo for the various components that make up
Pyth Crosschain. The base repository is a fork from Certus One's reference
[Wormhole][] implementation in order to take advantage of the existing tooling
for building projects based on Wormhole's various SDKs. Much of the existing
documentation from there will also apply to this repository.

[wormhole]: https://github.com/wormhole-foundation/wormhole

Within this monorepo you will find the following subprojects:

## Wormhole Attester

> wormhole-attester

The main Pyth implementation currently exists as an [on-chain contract][] on
Solana. In order to expose these prices cross-chain, the Wormhole Attester
contract acts as a sender for Pyth prices. At regular intervals the Pyth
contract will observe the current Pyth price for selected products, and produce
an attestation which is then relayed over Wormhole to be consumed by the
various receiver contracts.

[on-chain contract]: https://github.com/pyth-network/pyth-client

## Target Chains

### Ethereum

> target_chains/ethereum/contracts/pyth

The Ethereum contract acts as a receiver for Pyth prices relayed from the
Wormhole Attester. It also provides a public API for other Ethereum contracts
that can be used to consume Pyth prices. For a guide on using this API to
consume Pyth price feeds see [pyth-sdk-solidity][] which contains documented
examples.

[pyth-sdk-solidity]: https://github.com/pyth-network/pyth-sdk-solidity

## Price Service

> price_service

The Price Service is an off-chain service which constantly observes the
Wormhole network watching for price attestations emitted from the Pyth Solana
contract. It exposes all observed attestations via a public API over HTTPS/WSS
which can be consumed by client-side applications that wish to use Pyth pricing
data.

For a guide on utilising this service in your project, see the documentation in
the [pyth-js][] repository.

[pyth-js]: https://github.com/pyth-network/pyth-js

---

See [DEVELOP.md](DEVELOP.md) for instructions on how to set up a local devnet, and
[CONTRIBUTING.md](CONTRIBUTING.md) for instructions on how to contribute to this project.

### Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.

## Development

### Releases

We use [Semantic Versioning](https://semver.org/) for our releases.

### pre-commit hooks

pre-commit is a tool that checks and fixes simple issues (formatting, ...) before each commit. You can install it by following [their website](https://pre-commit.com/). In order to enable checks for this repo run `pre-commit install` from command-line in the root of this repo.

The checks are also performed in the CI to ensure the code follows consistent formatting.
