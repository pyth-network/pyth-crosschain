# Coin Flip Example application

The coin flip example demonstrates how to use Pyth Entropy to flip a fair coin.

## Try it out

To try the example, first run the following commands from the root of the `pyth-crosschain` repository:

```shell
npm install
npx lerna run build
```

These commands will build dependencies for the typescript project.

Next, choose a network to run the example on.
The example has been deployed on the following networks:

```
| Chain Name      | Address                                    | RPC                                        |
|-----------------|--------------------------------------------|--------------------------------------------|
| optimism-goerli | 0x3bA217Cd7840Cc5B34FD5B7263Cebd8CD8665788 | https://goerli.optimism.io                 |
| avalanche-fuji  | 0xE7E52C85907d59C45b2C56EF32B78F514F8c547a | https://api.avax-test.network/ext/bc/C/rpc |
| eos-evm-testnet | 0x413405Aee2db95cb028B60CBAd87FC0B932947f4 | https://api.testnet.evm.eosnetwork.com/    |
```

You will also need the private key of a wallet with some gas tokens for your chosen network.
Then, from the `coin_flip/app` directory, run the following command:

```
npm run flip-coin -- \
  --private-key <hexadecimal evm private key> \
  --chain-name <chain name> \
  --address <address> \
  --rpc-url <rpc url>
```

You can populate the arguments to this command from the table above.
The command should print output like this:

```text
Running coin flip prototcol.
1. Generating user's random number...
   number    : 0x79b029406af43b11937bca98c49633f9382ed7d3fc0d60e110258c5c8f0d1a05
   commitment: 0xd4bca63083f9fb9e83e68348cb48f45babd820fc3559c60ba9a67b0ab3845cea
2. Requesting coin flip...
   fee       : 87 wei
   tx        : 0x3a59bb8c1aaa8c6ff97147bb3197e9b89c0d87174b0b6c32374fc62de6d8db94
   sequence  : 50
3. Retrieving provider's random number...
   fetch url : https://fortuna-staging.pyth.network/v1/chains/optimism-goerli/revelations/50
   number    : 0x760e53a19a4677ef671fde63db59462dfb3e09e94418e9962e2fa764026b8400
4. Revealing the result of the coin flip...
   tx        : 0x0549b93b12684187f73ddcaf8351ca4049867882c1b138989e15363a4d103220
   result    : tails
```

## Understanding the Example

The example consists of a Solidity contract and a Typescript script.
See the extensive code comments in the contract at `contract/src/CoinFlip.sol` to learn how the example works.
The typescript script is available at `app/src/flip_coin.ts` and demonstrates how to interact with the contract.
