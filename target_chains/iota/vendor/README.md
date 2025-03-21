# Vendored dependencies for SUI contract

This directory contains the wormhole dependencies used for deploying Pyth contracts on the chains that Wormhole is not
officially deployed on. For each network, a slightly different variant of the code should be used that has the
`CHAIN_ID` constant (in `wormhole/sources/state.move`) and `Move.toml` modified. Therefore, we are storing
each of them in a separate directory.

The Wormhole contract is taken out of commit
[`e94c8ef4a810cae63d4e54811aa6a843b5fd9e65`](https://github.com/wormhole-foundation/wormhole/tree/e94c8ef4a810cae63d4e54811aa6a843b5fd9e65)
from the Wormhole repository. To update it, pull the latest version and copy it here and update the
README.
