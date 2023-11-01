# Pyth Entropy Solidity SDK

The Pyth Entropy Solidity SDK allows you to generate secure random numbers on the blockchain by
interacting with the Pyth Entropy protocol.
This SDK can be used for any application that requires random numbers, such as NFT mints, gaming, and more.

**WARNING**: The Entropy protocol is currently in testnet. It is **NOT INTENDED** for use in production applications.
Use this protocol at your own risk.

## Install

TODO

## Setup

To use the SDK, you need the address of an Entropy contract on your blockchain and a randomness provider.
The following table lists the current deployments of entropy.

| Chain | Entropy Address | Provider |
| avalanche-fuji | 0xD42c7a708E74AD19401D907a14146F006c851Ee3 | 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344
| optimism-goerli | 0x28F16Af4D87523910b843a801454AEde5F9B0459 | 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344
| eos-evm-testnet | 0xD42c7a708E74AD19401D907a14146F006c851Ee3 | 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344

Choose one of these networks and instantiate an `IEntropy` contract in your solidity contract:

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

Invoke the `request` method of the `IEntropy` contract:

```solidity
uint64 sequenceNumber = entropy.request(provider, commitment, true)
```

This method returns a sequence number. Store this sequence number for use in later steps.
If you are invoking this off-chain, the method also emits a `PythRandomEvents.Requested` event that contains the sequence number in it.

### 3. Fetch the provider's number

Fetch the provider's random number from them.
For the provider `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344` you can query the webservice at https://fortuna-staging.pyth.network :

```typescript
await axios.get(
  `https://fortuna-staging.pyth.network/v1/chains/${chainName}/revelations/${sequenceNumber}`
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
