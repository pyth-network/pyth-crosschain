# Pyth2Wormhole

This repository acts as a monorepo for the various components that make up
Pyth2Wormhole. The base repository is a fork from Certus One's reference
[Wormhole][] implementation in order to take advantage of the existing tooling
for building projects based on Wormhole's various SDKs. Much of the existing
documentation from there will also apply to this repository.

[Wormhole]: https://github.com/certusone/wormhole

Within this monorepo you will find the following subprojects:

## Pyth2Wormhole Solana
>  solana/pyth2wormhole


The main Pyth implementation currently exists as an [on-chain contract][] on
Solana. In order to expose these prices cross-chain, the Pyth2Wormhole Solana
contract acts as a sender for Pyth prices. At regular intervals the Pyth
contract will observe the current Pyth price for selected products, and produce
an attestation which is then relayed over Wormhole to be consumed by the
various P2W receiver contracts.

[on-chain contract]: https://github.com/pyth-network/pyth-client

## Pyth2Wormhole Ethereum
>  ethereum/contracts/pyth

The Ethereum P2W contract acts as a receiver for Pyth prices relayed from the
P2W Solana contract. It also provides a public API for other Ethereum contracts
that can be used to consume Pyth prices. For a guide on using this API to
consume Pyth price feeds see [pyth-evm-sdk][] which contains documented
examples.

[pyth-evm-sdk]: https://github.com/pyth-network/pyth-sdk-solidity

## Pyth2Wormhole Price Service
>  third_party/pyth

The P2W Price Service is an off-chain service which constantly observes the
Wormhole network watching for price attestations emitted from the Pyth Solana
contract. It exposes all observed attestations via a public API over HTTPS/WSS
which can be consumed by client-side applications that wish to use Pyth pricing
data.

For a guide on utilising this service in your project, see the documentation in
the [pyth-js][] repository.

[pyth-js]: https://github.com/pyth-network/pyth-js

--------------------------------------------------------------------------------

See [DEVELOP.md](DEVELOP.md) for instructions on how to set up a local devnet, and
[CONTRIBUTING.md](CONTRIBUTING.md) for instructions on how to contribute to this project.

### Audit / Feature Status

⚠ **This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions and limitations under the License.** Or plainly
spoken - this is a very complex piece of software which targets a bleeding-edge, experimental smart contract runtime.
Mistakes happen, and no matter how hard you try and whether you pay someone to audit it, it may eat your tokens, set
your printer on fire or startle your cat. Cryptocurrencies are a high-risk investment, no matter how fancy.
