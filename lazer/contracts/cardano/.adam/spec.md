# Pyth Cardano Integration Design Specification
We are integrating Pyth's price feeds into Cardano to provide real-time, reliable price data for decentralized applications (dApps) and smart contracts on the Cardano blockchain. This integration will enable developers to access accurate and up-to-date price information for various assets, enhancing the functionality and user experience of their applications.

The goals of the integration are as follows:
1. Allow users to fetch and parse Pyth price feed data in their dApps and smart contracts on Cardano.
2. Ensure the integrity and authenticity of the price data by validating the signatures of Pyth prices on-chain. We will use the ed25519 signature scheme for this purpose.

The integration will involve the following key components:
* Pyth Cardano Library
* Pyth Price Verification Contract
* Pyth trusted signer public keys
* Pyth NFT Minting Policy

# Usage
To use Pyth price feeds on Cardano, developers will interact with the Pyth sdk to fetch price feed data off chain. Users will use the Pyth Cardano Library to parse the price payload and use the price(s) as inputs to their on-chain contracts. Optionally, users can also attach the signed payload to the transaction and use the Pyth Price Verification Contract to verify the authenticity of the price data on-chain. 

## On-chain verification
To have the Pyth Price Verification Contract verify the authenticity of the price data on-chain, users will need to:
 1. Include the signed price payload in the transaction as an inline datum.
 2. Include the Pyth trusted signer public keys in the transaction as an inline datum.
 3. Use the "withdraw 0 trick" to trigger the Pyth Price Verification Contract to validate the price data.

# Design
## Pyth Cardano Library
The Pyth Cardano Library will provide developers with the necessary tools to interact with Pyth prices. It will include functions to parse Pyth price feed data and to build transactions that validate the price data using the Pyth price verification contract. This library is written in typescript.

The library should define these data types:
* SigningPolicy: A list of trusted signer public keys that are used to verify the signatures of Pyth price feed data on-chain.
* PriceUpdate: A data type that represents a Pyth price update, not including the signatures.

The library should include the following functions:
* validate_price_message: A function that takes a raw price message (byte array) and the trusted signer public keys as input and returns a boolean indicating whether the price message is valid or not.

* parse_price_message: A function that takes a raw price message (byte array) as input and returns a PriceUpdate data type containing the parsed price information.

## Pyth Price Verification Contract
The Pyth Price Verification Contract is a smart contract on Cardano that verifies the authenticity of Pyth price feed data by validating the signatures of the price data using the ed25519 signature scheme. This contract is written in Aiken.

The contract should trigger on the "withdraw 0 trick" and perform the following steps:
1. Read the signed price payload from the inline datum of the transaction.
2. Read the Pyth trusted signer public keys from the inline datum of the transaction.
3. Confirm that the datum containing the trusted signer public keys contains the Pyth NFT, which attests to the authenticity of the public keys.
4. Use the Pyth Cardano Library's validate_price_message function to verify the signatures of the price data using the trusted signer public keys.

## Pyth Trusted Signer Public Keys
The Pyth trusted signer public keys are a set of public keys that are used to verify the signatures of Pyth price feed data on-chain. These keys will be stored in an inline datum on the Cardano blockchain.

## Pyth NFT Minting Policy
The Pyth NFT Minting Policy is a minting policy for a Pyth NFT that attests to the authenticity of the trusted signer public keys - presence of the NFT in a datum indicates that the public keys in the datum are authentic.

# Implementation Guidelines
1. All code should be well-documented and follow best practices for readability and maintainability.
2. The Aiken contract should be optimized for efficiency, especially in the signature verification process.
3. All functionality should be thoroughly tested, including unit tests for the library functions and integration tests for the on-chain verification process.
4. Security considerations should be taken into account, especially in the handling of the trusted signer public keys, and the on-chain verification of signatures to prevent any potential vulnerabilities.

# References
1. Aiken Language tour: https://aiken-lang.org/language-tour
2. Aiken standard library: https://aiken-lang.github.io/stdlib/
3. Withdraw 0 trick: https://github.com/Anastasia-Labs/design-patterns/blob/main/stake-validator/STAKE-VALIDATOR-TRICK.md
4. Examples of Pyth implementations on other chains are available in this codebase under lazer/contracts.
5. Pyth/Cardano integration design doc: https://www.notion.so/pyth-network/Pyth-Cardano-Integration-2b72eecaaac980b8a17cf68691e2852c
