# Pyth Entropy Solidity SDK

The Pyth Entropy Solidity SDK allows you to generate secure random numbers on the blockchain by
interacting with the Pyth Entropy protocol.
This SDK can be used for any application that requires random numbers, such as NFT mints, gaming, and more.

## Install

###Truffle/Hardhat

If you are using Truffle or Hardhat, simply install the NPM package:

```bash
npm install @pythnetwork/entropy-sdk-solidity
```

###Foundry

If you are using Foundry, you will need to create an NPM project if you don't already have one.
From the root directory of your project, run:

```bash
npm init -y
npm install @pythnetwork/entropy-sdk-solidity
```

Then add the following line to your `remappings.txt` file:

```text
@pythnetwork/entropy-sdk-solidity/=node_modules/@pythnetwork/entropy-sdk-solidity
```

## Setup

To use the SDK, you need the address of an Entropy contract on your blockchain and a randomness provider.
You can find current deployments on this [page](https://docs.pyth.network/documentation/entropy/evm).

Choose one of the networks and instantiate an `IEntropy` contract in your solidity contract:

```solidity
 IEntropy entropy = IEntropy(<address>);
```

## Usage

To generate a random number, follow these steps.

### 1. Commit to a random number

Generate a 32-byte random number on the client side, then hash it with keccak256 to create a commitment.
You can do this with typescript and web3.js as follows:

```typescript
const randomNumber = web3.utils.randomHex(32);
const commitment = web3.utils.keccak256(randomNumber);
```

### 2. Request a number from Entropy

Invoke the `request` method of the `IEntropy` contract.
The `request` method requires paying a fee in native gas tokens which is configured per-provider.
Use the `getFee` method to calculate the fee and send it as the value of the `request` call:

```solidity
uint fee = entropy.getFee(provider);
uint64 sequenceNumber = entropy.request{value: fee}(provider, commitment, true);
```

This method returns a sequence number. Store this sequence number for use in later steps.
If you are invoking this off-chain, the method also emits a `PythRandomEvents.Requested` event that contains the sequence number in it.

### 3. Fetch the provider's number

Fetch the provider's random number from them.
For the provider `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344` you can query the webservice at https://fortuna-staging.dourolabs.app :

```typescript
await axios.get(
  `https://fortuna-staging.dourolabs.app/v1/chains/${chainName}/revelations/${sequenceNumber}`,
);
```

This method returns a JSON object containing the provider's random number.

### 4. Reveal the number

Invoke the `reveal` method on the `IEntropy` contract:

```solidity
bytes32 randomNumber = entropy.reveal(
    provider,
    sequenceNumber,
    randomNumber,
    providerRandomNumber
)
```

This method will combine the user and provider's random numbers, along with the blockhash, to construct the final secure random number.

## Example Application

The [Coin Flip](/target_chains/ethereum/examples/coin_flip) example demonstrates how to build a smart contract that
interacts with Pyth Entropy as well as a typescript client for that application.

## PRNG Contract

The PRNG (Pseudorandom Number Generation) Contract is designed to work seamlessly with Pyth Entropy.

### Features

- **Pyth Entropy Integration**: Utilizes Pyth Entropy as a secure seed source
- **Stateful Randomness**: Maintains an internal state to ensure unique random numbers on each call
- **Versatile Random Generation**: Includes functions for generating random uint256, uint64, integers within specified ranges, and permutations
- **Random Bytes Generation**: Ability to generate random byte sequences of specified length

### Key Functions

- `randUint() -> uint256`: Generate a random uint256 value
- `randUint64() -> uint64`: Generate a random uint64 value
- `randUintRange(uint256 min, uint256 max) -> uint256`: Generate a random integer within a specified range
- `randomBytes(uint256 length) -> bytes`: Generate a sequence of random bytes
- `randomPermutation(uint256 length) -> uint256[]`: Generate a random permutation of a sequence

### Usage

To use the PRNG contract in your project:

1. Create a contract that inherits from PRNG and uses its internal functions with a seed from Pyth Entropy:

```solidity
contract MyContract is PRNG {
  constructor(bytes32 _seed) {
    PRNG(_seed);
  }
}
```

2. Use the contract functions to generate random numbers:

```solidity
bytes32 pythEntropySeed = ...; // Get this from Pyth Entropy
setSeed(pythEntropySeed)
uint256 randomNumber = randUint();
uint64 randomSmallNumber = randUint64();
uint256 randomInRange = randUintRange(1, 100);
```
