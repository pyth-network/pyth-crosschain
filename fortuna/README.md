# Pyth Entropy

Entropy is a protocol for generating secure random numbers on the blockchain.
The protocol is a generalization of a simple two-party commit/reveal protocol (TODO: link).
Developers can use entropy to integrate random numbers into NFT drops, games, and more.

## Integrating

Integrating randomness into your application requires users to perform two steps,
to request and reveal the random number.

## 0. Install the Entropy SDK

// TODO: install instructions and import instructions

```solidity
# TODO: imports
PythEntropy entropy = new PythEntropy(TODO: address);
address provider = // TODO;
```

### 1. Request a random number

In the first step, users request a random number. They generate a random number themselves,
hash it to generate a commitment, then submit the commitment to your contract. Your contract
will then pass the commitment to the entropy contract.

```typescript
let userRandomness = Math.random();
contract.requestMint();
```

The `requestMint` function on your contract should look something like this:

```solidity
function requestMint(bytes32 userCommitment) {
  uint256 fee = entropy.getFee(provider);
  uint64 sequenceNumber = entropy.request{ value: fee }(
    provider,
    userCommitment,
    true
  );

  requestedMints[sequenceNumber] = msg.sender;
}

```

Note that the

### 3. Reveal the random number

To reveal the random number, retrieve the sequence number of the request,
and pass the sequence number to the provider's randomness webservice. This service
will return a revelation from the provider, which can be submitted along with the sequence number and
the user's random value to generate the final random number.

```typescript
// ??? how to do this in ethers?

import axios from "axios";

val payload = axios.fetch(providerUrl, ...);

contract.revealMint(sequenceNumber, userRandom, providerRandom);
```

The revealMint function should look something like this:

```solidity
function revealMint(
  uint64 sequenceNumber,
  bytes32 userRandom,
  bytes32 providerRandom
) {
  if (requestedMints[sequenceNumber] != msg.sender) revert;

  bytes32 random = entropy.reveal(
    provider,
    sequenceNumber,
    userRandom,
    providerRandom
  );

  // TODO: PRNG?
}

```

### 4. Use the random number

TODO: create a PRNG class to let people draw random numbers in a sane way from the bytes32 seed

### 5. Next steps

- link to worked example
-
